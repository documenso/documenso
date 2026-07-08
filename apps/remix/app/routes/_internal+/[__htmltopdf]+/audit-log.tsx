import { DOCUMENT_STATUS } from '@documenso/lib/constants/document';
import { APP_I18N_OPTIONS, ZSupportedLanguageCodeSchema } from '@documenso/lib/constants/i18n';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { unsafeGetEntireEnvelope } from '@documenso/lib/server-only/admin/get-entire-document';
import { decryptSecondaryData } from '@documenso/lib/server-only/crypto/decrypt';
import { findDocumentAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';
import { getOrganisationClaimByTeamId } from '@documenso/lib/server-only/organisation/get-organisation-claims';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { getTranslations } from '@documenso/lib/utils/i18n';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { EnvelopeType } from '@prisma/client';
import { DateTime } from 'luxon';
import { redirect } from 'react-router';

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

  const organisationClaim = await getOrganisationClaimByTeamId({ teamId: envelope.teamId });

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
    hidePoweredBy: organisationClaim.flags.hidePoweredBy,
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
  const { auditLogs, document, documentLanguage, hidePoweredBy, messages } = loaderData;

  const { i18n, _ } = useLingui();

  i18n.loadAndActivate({ locale: documentLanguage, messages });

  return (
    <div className="print-provider pointer-events-none mx-auto max-w-screen-md">
      <header>
        <h1 className="font-semibold text-lg tracking-tight">{_(msg`Audit Log`)}</h1>

        <p className="mt-1 text-pretty text-muted-foreground text-sm">{document.title}</p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5">
        <div>
          <dt className="font-medium text-muted-foreground text-xs">{_(msg`Envelope ID`)}</dt>

          <dd className="mt-1 break-all text-foreground text-sm print:text-xs">{document.envelopeId}</dd>
        </div>

        <div>
          <dt className="font-medium text-muted-foreground text-xs">{_(msg`Owner`)}</dt>

          <dd className="mt-1 break-words text-foreground text-sm print:text-xs">
            {document.user.name} ({document.user.email})
          </dd>
        </div>

        <div>
          <dt className="font-medium text-muted-foreground text-xs">{_(msg`Status`)}</dt>

          <dd className="mt-1 text-foreground text-sm print:text-xs">
            {_(document.deletedAt ? msg`Deleted` : DOCUMENT_STATUS[document.status].description)}
          </dd>
        </div>

        <div>
          <dt className="font-medium text-muted-foreground text-xs">{_(msg`Time Zone`)}</dt>

          <dd className="mt-1 break-words text-foreground text-sm print:text-xs">
            {document.documentMeta?.timezone ?? 'N/A'}
          </dd>
        </div>

        <div>
          <dt className="font-medium text-muted-foreground text-xs">{_(msg`Created At`)}</dt>

          <dd className="mt-1 text-foreground text-sm print:text-xs">
            {DateTime.fromJSDate(document.createdAt)
              .setLocale(APP_I18N_OPTIONS.defaultLocale)
              .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')}
          </dd>
        </div>

        <div>
          <dt className="font-medium text-muted-foreground text-xs">{_(msg`Last Updated`)}</dt>

          <dd className="mt-1 text-foreground text-sm print:text-xs">
            {DateTime.fromJSDate(document.updatedAt)
              .setLocale(APP_I18N_OPTIONS.defaultLocale)
              .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')}
          </dd>
        </div>

        <div>
          <dt className="font-medium text-muted-foreground text-xs">{_(msg`Enclosed Document`)}</dt>

          <dd className="mt-1 break-words text-foreground text-sm print:text-xs">{document.title}</dd>
        </div>

        <div>
          <dt className="font-medium text-muted-foreground text-xs">{_(msg`Recipients`)}</dt>

          <dd className="mt-1 text-foreground text-sm print:text-xs">
            <ul className="space-y-0.5">
              {document.recipients.map((recipient) => (
                <li key={recipient.id} className="break-words">
                  {recipient.name} ({recipient.email}) ·{' '}
                  <span className="text-muted-foreground">
                    {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      <div className="mt-8">
        <InternalAuditLogTable logs={auditLogs} />
      </div>

      {!hidePoweredBy && (
        <div className="my-8 flex-row-reverse">
          <div className="flex items-end justify-end gap-x-4">
            <BrandingLogo className="max-h-6 print:max-h-4" />
          </div>
        </div>
      )}
    </div>
  );
}
