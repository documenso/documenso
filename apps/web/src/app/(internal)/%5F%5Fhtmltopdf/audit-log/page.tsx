import React from 'react';

import { redirect } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { DOCUMENT_STATUS } from '@documenso/lib/constants/document';
import { APP_I18N_OPTIONS, ZSupportedLanguageCodeSchema } from '@documenso/lib/constants/i18n';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { getEntireDocument } from '@documenso/lib/server-only/admin/get-entire-document';
import { decryptSecondaryData } from '@documenso/lib/server-only/crypto/decrypt';
import { findDocumentAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';
import { dynamicActivate } from '@documenso/lib/utils/i18n';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { Logo } from '~/components/branding/logo';

import { AuditLogDataTable } from './data-table';

type AuditLogProps = {
  searchParams: {
    d: string;
  };
};

/**
 * DO NOT USE TRANS. YOU MUST USE _ FOR THIS FILE AND ALL CHILDREN COMPONENTS.
 *
 * Cannot use dynamicActivate by itself to translate this specific page and all
 * children components because `not-found.tsx` page runs and overrides the i18n.
 */
export default async function AuditLog({ searchParams }: AuditLogProps) {
  const { i18n } = await setupI18nSSR();

  const { _ } = useLingui();

  const { d } = searchParams;

  if (typeof d !== 'string' || !d) {
    return redirect('/');
  }

  const rawDocumentId = decryptSecondaryData(d);

  if (!rawDocumentId || isNaN(Number(rawDocumentId))) {
    return redirect('/');
  }

  const documentId = Number(rawDocumentId);

  const document = await getEntireDocument({
    id: documentId,
  }).catch(() => null);

  if (!document) {
    return redirect('/');
  }

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(document.documentMeta?.language);

  await dynamicActivate(i18n, documentLanguage);

  const { data: auditLogs } = await findDocumentAuditLogs({
    documentId: documentId,
    userId: document.userId,
    perPage: 100_000,
  });

  return (
    <div className="print-provider pointer-events-none mx-auto max-w-screen-md">
      <div className="flex items-center">
        <h1 className="my-8 text-2xl font-bold">{_(msg`Version History`)}</h1>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-6 text-sm print:text-xs">
          <p>
            <span className="font-medium">{_(msg`Document ID`)}</span>

            <span className="mt-1 block break-words">{document.id}</span>
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
              {document.User.name} ({document.User.email})
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
              {document.Recipient.map((recipient) => (
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

      <Card className="mt-8">
        <CardContent className="p-0">
          <AuditLogDataTable logs={auditLogs} />
        </CardContent>
      </Card>

      <div className="my-8 flex-row-reverse">
        <div className="flex items-end justify-end gap-x-4">
          <Logo className="max-h-6 print:max-h-4" />
        </div>
      </div>
    </div>
  );
}
