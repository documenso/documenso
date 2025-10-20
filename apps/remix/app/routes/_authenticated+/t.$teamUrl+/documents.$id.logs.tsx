import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType, type Recipient } from '@prisma/client';
import { ChevronLeft } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { logDocumentAccess } from '@documenso/lib/utils/logger';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { Card } from '@documenso/ui/primitives/card';

import { DocumentAuditLogDownloadButton } from '~/components/general/document/document-audit-log-download-button';
import { DocumentCertificateDownloadButton } from '~/components/general/document/document-certificate-download-button';
import {
  DocumentStatus as DocumentStatusComponent,
  FRIENDLY_STATUS_MAP,
} from '~/components/general/document/document-status';
import { DocumentLogsTable } from '~/components/tables/document-logs-table';

import type { Route } from './+types/documents.$id.logs';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { id, teamUrl } = params;

  if (!id || !teamUrl) {
    throw new Response('Not Found', { status: 404 });
  }

  const { user } = await getSession(request);

  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  const documentRootPath = formatDocumentsPath(team.url);

  const envelope = await getEnvelopeById({
    id: {
      type: 'envelopeId',
      id,
    },
    type: EnvelopeType.DOCUMENT,
    userId: user.id,
    teamId: team.id,
  }).catch(() => null);

  if (!envelope) {
    throw new Response('Not Found', { status: 404 });
  }

  logDocumentAccess({
    request,
    documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
    userId: user.id,
  });

  return {
    // Only return necessary data
    document: {
      id: mapSecondaryIdToDocumentId(envelope.secondaryId),
      envelopeId: envelope.id,
      title: envelope.title,
      status: envelope.status,
      user: {
        name: envelope.user.name,
        email: envelope.user.email,
      },
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
      documentMeta: envelope.documentMeta,
    },
    recipients: envelope.recipients,
    documentRootPath,
  };
}

export default function DocumentsLogsPage({ loaderData }: Route.ComponentProps) {
  const { document, recipients, documentRootPath } = loaderData;

  const { _, i18n } = useLingui();

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
      value: document.user.name
        ? `${document.user.name} (${document.user.email})`
        : document.user.email,
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
        to={`${documentRootPath}/${document.envelopeId}`}
        className="flex items-center text-[#7AC455] hover:opacity-80"
      >
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        <Trans>Document</Trans>
      </Link>

      <div className="flex flex-col">
        <div>
          <h1
            className="mt-4 block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
            title={document.title}
          >
            {document.title}
          </h1>
        </div>
        <div className="mt-1 flex flex-col justify-between sm:flex-row">
          <div className="mt-2.5 flex items-center gap-x-6">
            <DocumentStatusComponent
              inheritColor
              status={document.status}
              className="text-muted-foreground"
            />
          </div>
          <div className="mt-4 flex w-full flex-row sm:mt-0 sm:w-auto sm:self-end">
            <DocumentCertificateDownloadButton
              className="mr-2"
              documentId={document.id}
              documentStatus={document.status}
            />

            <DocumentAuditLogDownloadButton documentId={document.id} />
          </div>
        </div>
      </div>

      <section className="mt-6">
        <Card className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2" degrees={45} gradient>
          {documentInformation.map((info, i) => (
            <div className="text-foreground text-sm" key={i}>
              <h3 className="font-semibold">{_(info.description)}</h3>
              <p className="text-muted-foreground truncate">{info.value}</p>
            </div>
          ))}

          <div className="text-foreground text-sm">
            <h3 className="font-semibold">Recipients</h3>
            <ul className="text-muted-foreground list-inside list-disc">
              {recipients.map((recipient) => (
                <li key={`recipient-${recipient.id}`}>
                  <span>{formatRecipientText(recipient)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <DocumentLogsTable documentId={document.id} />
      </section>
    </div>
  );
}
