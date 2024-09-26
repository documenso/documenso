import Link from 'next/link';
import { redirect } from 'next/navigation';

import type { MessageDescriptor } from '@lingui/core';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { ChevronLeft } from 'lucide-react';
import { DateTime } from 'luxon';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Recipient, Team } from '@documenso/prisma/client';
import { Card } from '@documenso/ui/primitives/card';

import {
  DocumentStatus as DocumentStatusComponent,
  FRIENDLY_STATUS_MAP,
} from '~/components/formatter/document-status';

import { DocumentLogsDataTable } from './document-logs-data-table';
import { DownloadAuditLogButton } from './download-audit-log-button';
import { DownloadCertificateButton } from './download-certificate-button';

export type DocumentLogsPageViewProps = {
  params: {
    id: string;
  };
  team?: Team;
};

export const DocumentLogsPageView = async ({ params, team }: DocumentLogsPageViewProps) => {
  const { _, i18n } = useLingui();

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

  const documentInformation: { description: MessageDescriptor; value: string }[] = [
    {
      description: msg`Document title`,
      value: document.title,
    },
    {
      description: msg`Document ID`,
      value: document.id.toString(),
    },
    {
      description: msg`Document status`,
      value: _(FRIENDLY_STATUS_MAP[document.status].label),
    },
    {
      description: msg`Created by`,
      value: document.User.name
        ? `${document.User.name} (${document.User.email})`
        : document.User.email,
    },
    {
      description: msg`Date created`,
      value: DateTime.fromJSDate(document.createdAt)
        .setLocale(i18n.locales?.[0] || i18n.locale)
        .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS),
    },
    {
      description: msg`Last updated`,
      value: DateTime.fromJSDate(document.updatedAt)
        .setLocale(i18n.locales?.[0] || i18n.locale)
        .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS),
    },
    {
      description: msg`Time zone`,
      value: document.documentMeta?.timezone ?? 'N/A',
    },
  ];

  const formatRecipientText = (recipient: Recipient) => {
    let text = recipient.email;

    if (recipient.name) {
      text = `${recipient.name} (${recipient.email})`;
    }

    return `[${recipient.role}] ${text}`;
  };

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <Link
        href={`${documentRootPath}/${document.id}`}
        className="flex items-center text-[#7AC455] hover:opacity-80"
      >
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        <Trans>Document</Trans>
      </Link>

      <div className="flex flex-col justify-between truncate sm:flex-row">
        <div>
          <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl" title={document.title}>
            {document.title}
          </h1>

          <div className="mt-2.5 flex items-center gap-x-6">
            <DocumentStatusComponent
              inheritColor
              status={document.status}
              className="text-muted-foreground"
            />
          </div>
        </div>

        <div className="mt-4 flex w-full flex-row sm:mt-0 sm:w-auto sm:self-end">
          <DownloadCertificateButton
            className="mr-2"
            documentId={document.id}
            documentStatus={document.status}
          />

          <DownloadAuditLogButton teamId={team?.id} documentId={document.id} />
        </div>
      </div>

      <section className="mt-6">
        <Card className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2" degrees={45} gradient>
          {documentInformation.map((info, i) => (
            <div className="text-foreground text-sm" key={i}>
              <h3 className="font-semibold">{_(info.description)}</h3>
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
