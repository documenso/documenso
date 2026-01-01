import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { EnvelopeType } from '@prisma/client';
import { DateTime } from 'luxon';
import { redirect } from 'react-router';

import { DOCUMENT_STATUS } from '@documenso/lib/constants/document';
import { APP_I18N_OPTIONS, ZSupportedLanguageCodeSchema } from '@documenso/lib/constants/i18n';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { unsafeGetEntireEnvelope } from '@documenso/lib/server-only/admin/get-entire-document';
import { decryptSecondaryData } from '@documenso/lib/server-only/crypto/decrypt';
import { findDocumentAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { getTranslations } from '@documenso/lib/utils/i18n';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import appStylesheet from '~/app.css?url';
import { BrandingLogo } from '~/components/general/branding-logo';
import { InternalAuditLogTable } from '~/components/tables/internal-audit-log-table';

import type { Route } from './+types/audit-log';
import auditLogStylesheet from './audit-log.print.css?url';

export const links: Route.LinksFunction = () => [
  { rel: 'stylesheet', href: appStylesheet },
  { rel: 'stylesheet', href: auditLogStylesheet },
];

export async function loader({ request }: Route.LoaderArgs) {
  const d = new URL(request.url).searchParams.get('d');

  if (typeof d !== 'string' || !d) {
    throw redirect('/');
  }

  const rawDocumentId = decryptSecondaryData(d);

  if (!rawDocumentId || isNaN(Number(rawDocumentId))) {
    throw redirect('/');
  }

  const documentId = Number(rawDocumentId);

  const envelope = await unsafeGetEntireEnvelope({
    id: {
      type: 'documentId',
      id: documentId,
    },
    type: EnvelopeType.DOCUMENT,
  }).catch(() => null);

  if (!envelope) {
    throw redirect('/');
  }

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(envelope.documentMeta?.language);

  const { data: auditLogs } = await findDocumentAuditLogs({
    documentId: documentId,
    userId: envelope.userId,
    teamId: envelope.teamId,
    perPage: 100_000,
  });

  const messages = await getTranslations(documentLanguage);

  return {
    auditLogs,
    document: {
      id: mapSecondaryIdToDocumentId(envelope.secondaryId),
      title: envelope.title,
      status: envelope.status,
      envelopeId: envelope.id,
      user: {
        name: envelope.user.name,
        email: envelope.user.email,
      },
      recipients: envelope.recipients,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
      deletedAt: envelope.deletedAt,
      documentMeta: envelope.documentMeta,
    },
    documentLanguage,
    messages,
  };
}

/**
 * DO NOT USE TRANS. YOU MUST USE _ FOR THIS FILE AND ALL CHILDREN COMPONENTS.
 *
 * Cannot use dynamicActivate by itself to translate this specific page and all
 * children components because `not-found.tsx` page runs and overrides the i18n.
 *
 * Update: Maybe <Trans> tags work now after RR7 migration.
 */
export default function AuditLog({ loaderData }: Route.ComponentProps) {
  const { auditLogs, document, documentLanguage, messages } = loaderData;

  const { i18n, _ } = useLingui();

  i18n.loadAndActivate({ locale: documentLanguage, messages });

  return (
    <div className="print-provider pointer-events-none mx-auto max-w-screen-md">
      <div className="mb-6 border-b pb-4">
        <h1 className="text-xl font-semibold">{_(msg`Audit Log`)}</h1>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-6 text-sm print:text-xs">
          <p>
            <span className="font-medium">{_(msg`Envelope ID`)}</span>

            <span className="mt-1 block break-words">{document.envelopeId}</span>
          </p>

          <p>
            <span className="font-medium">{_(msg`Enclosed Document`)}</span>

            <span className="mt-1 block break-words">{document.title}</span>
          </p>

          <p>
            <span className="font-medium">{_(msg`Status`)}</span>

            <span className="mt-1 block">
              {_(
                document.deletedAt ? msg`Deleted` : DOCUMENT_STATUS[document.status].description,
              ).toUpperCase()}
            </span>
          </p>

          <p>
            <span className="font-medium">{_(msg`Owner`)}</span>

            <span className="mt-1 block break-words">
              {document.user.name} ({document.user.email})
            </span>
          </p>

          <p>
            <span className="font-medium">{_(msg`Created At`)}</span>

            <span className="mt-1 block">
              {DateTime.fromJSDate(document.createdAt)
                .setLocale(APP_I18N_OPTIONS.defaultLocale)
                .toFormat('yyyy-mm-dd hh:mm:ss a (ZZZZ)')}
            </span>
          </p>

          <p>
            <span className="font-medium">{_(msg`Last Updated`)}</span>

            <span className="mt-1 block">
              {DateTime.fromJSDate(document.updatedAt)
                .setLocale(APP_I18N_OPTIONS.defaultLocale)
                .toFormat('yyyy-mm-dd hh:mm:ss a (ZZZZ)')}
            </span>
          </p>

          <p>
            <span className="font-medium">{_(msg`Time Zone`)}</span>

            <span className="mt-1 block break-words">
              {document.documentMeta?.timezone ?? 'N/A'}
            </span>
          </p>

          <div>
            <p className="font-medium">{_(msg`Recipients`)}</p>

            <ul className="mt-1 list-inside list-disc">
              {document.recipients.map((recipient) => (
                <li key={recipient.id}>
                  <span className="text-muted-foreground">
                    [{_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}]
                  </span>{' '}
                  {recipient.name} ({recipient.email})
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <InternalAuditLogTable logs={auditLogs} />
      </div>

      <div className="my-8 flex-row-reverse">
        <div className="flex items-end justify-end gap-x-4">
          <BrandingLogo className="max-h-6 print:max-h-4" />
        </div>
      </div>
    </div>
  );
}
