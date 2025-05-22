import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { FieldType, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { redirect } from 'react-router';
import { match } from 'ts-pattern';
import { UAParser } from 'ua-parser-js';
import { renderSVG } from 'uqr';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { APP_I18N_OPTIONS, ZSupportedLanguageCodeSchema } from '@documenso/lib/constants/i18n';
import {
  RECIPIENT_ROLES_DESCRIPTION,
  RECIPIENT_ROLE_SIGNING_REASONS,
} from '@documenso/lib/constants/recipient-roles';
import { getEntireDocument } from '@documenso/lib/server-only/admin/get-entire-document';
import { decryptSecondaryData } from '@documenso/lib/server-only/crypto/decrypt';
import { getDocumentCertificateAuditLogs } from '@documenso/lib/server-only/document/get-document-certificate-audit-logs';
import { getOrganisationClaimByTeamId } from '@documenso/lib/server-only/organisation/get-organisation-claims';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { getTranslations } from '@documenso/lib/utils/i18n';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

import { BrandingLogo } from '~/components/general/branding-logo';

import type { Route } from './+types/certificate';

const FRIENDLY_SIGNING_REASONS = {
  ['__OWNER__']: msg`I am the owner of this document`,
  ...RECIPIENT_ROLE_SIGNING_REASONS,
};

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

  const document = await getEntireDocument({
    id: documentId,
  }).catch(() => null);

  if (!document) {
    throw redirect('/');
  }

  const organisationClaim = await getOrganisationClaimByTeamId({ teamId: document.teamId });

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(document.documentMeta?.language);

  const auditLogs = await getDocumentCertificateAuditLogs({
    id: documentId,
  });

  const messages = await getTranslations(documentLanguage);

  return {
    document,
    hidePoweredBy: organisationClaim.flags.hidePoweredBy,
    documentLanguage,
    auditLogs,
    messages,
  };
}

/**
/**
 * DO NOT USE TRANS. YOU MUST USE _ FOR THIS FILE AND ALL CHILDREN COMPONENTS.
 *
 * Cannot use dynamicActivate by itself to translate this specific page and all
 * children components because `not-found.tsx` page runs and overrides the i18n.
 *
 * Update: Maybe <Trans> tags work now after RR7 migration.
 */
export default function SigningCertificate({ loaderData }: Route.ComponentProps) {
  const { document, documentLanguage, hidePoweredBy, auditLogs, messages } = loaderData;

  const { i18n, _ } = useLingui();

  i18n.loadAndActivate({ locale: documentLanguage, messages });

  const isOwner = (email: string) => {
    return email.toLowerCase() === document.user.email.toLowerCase();
  };

  const getDevice = (userAgent?: string | null) => {
    if (!userAgent) {
      return 'Unknown';
    }

    const parser = new UAParser(userAgent);

    parser.setUA(userAgent);

    const result = parser.getResult();

    return `${result.os.name} - ${result.browser.name} ${result.browser.version}`;
  };

  const getAuthenticationLevel = (recipientId: number) => {
    const recipient = document.recipients.find((recipient) => recipient.id === recipientId);

    if (!recipient) {
      return 'Unknown';
    }

    const extractedAuthMethods = extractDocumentAuthMethods({
      documentAuth: document.authOptions,
      recipientAuth: recipient.authOptions,
    });

    let authLevel = match(extractedAuthMethods.derivedRecipientActionAuth)
      .with('ACCOUNT', () => _(msg`Account Re-Authentication`))
      .with('TWO_FACTOR_AUTH', () => _(msg`Two-Factor Re-Authentication`))
      .with('PASSKEY', () => _(msg`Passkey Re-Authentication`))
      .with('EXPLICIT_NONE', () => _(msg`Email`))
      .with(null, () => null)
      .exhaustive();

    if (!authLevel) {
      authLevel = match(extractedAuthMethods.derivedRecipientAccessAuth)
        .with('ACCOUNT', () => _(msg`Account Authentication`))
        .with(null, () => _(msg`Email`))
        .exhaustive();
    }

    return authLevel;
  };

  const getRecipientAuditLogs = (recipientId: number) => {
    return {
      [DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT]: auditLogs[DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT && log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED &&
          log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED &&
          log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED &&
          log.data.recipientId === recipientId,
      ),
    };
  };

  const getRecipientSignatureField = (recipientId: number) => {
    return document.recipients
      .find((recipient) => recipient.id === recipientId)
      ?.fields.find(
        (field) => field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE,
      );
  };

  return (
    <div className="print-provider pointer-events-none mx-auto max-w-screen-md">
      <div className="flex items-center">
        <h1 className="my-8 text-2xl font-bold">{_(msg`Signing Certificate`)}</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table overflowHidden>
            <TableHeader>
              <TableRow>
                <TableHead>{_(msg`Signer Events`)}</TableHead>
                <TableHead>{_(msg`Signature`)}</TableHead>
                <TableHead>{_(msg`Details`)}</TableHead>
                {/* <TableHead>Security</TableHead> */}
              </TableRow>
            </TableHeader>

            <TableBody className="print:text-xs">
              {document.recipients.map((recipient, i) => {
                const logs = getRecipientAuditLogs(recipient.id);
                const signature = getRecipientSignatureField(recipient.id);

                return (
                  <TableRow key={i} className="print:break-inside-avoid">
                    <TableCell truncate={false} className="w-[min-content] max-w-[220px] align-top">
                      <div className="hyphens-auto break-words font-medium">{recipient.name}</div>
                      <div className="break-all">{recipient.email}</div>
                      <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                        {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                      </p>

                      <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                        <span className="font-medium">{_(msg`Authentication Level`)}:</span>{' '}
                        <span className="block">{getAuthenticationLevel(recipient.id)}</span>
                      </p>
                    </TableCell>

                    <TableCell truncate={false} className="w-[min-content] align-top">
                      {signature ? (
                        <>
                          <div
                            className="inline-block rounded-lg p-1"
                            style={{
                              boxShadow: `0px 0px 0px 4.88px rgba(122, 196, 85, 0.1), 0px 0px 0px 1.22px rgba(122, 196, 85, 0.6), 0px 0px 0px 0.61px rgba(122, 196, 85, 1)`,
                            }}
                          >
                            {signature.signature?.signatureImageAsBase64 && (
                              <img
                                src={`${signature.signature?.signatureImageAsBase64}`}
                                alt="Signature"
                                className="max-h-12 max-w-full"
                              />
                            )}

                            {signature.signature?.typedSignature && (
                              <p className="font-signature text-center text-sm">
                                {signature.signature?.typedSignature}
                              </p>
                            )}
                          </div>

                          <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                            <span className="font-medium">{_(msg`Signature ID`)}:</span>{' '}
                            <span className="block font-mono uppercase">
                              {signature.secondaryId}
                            </span>
                          </p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">N/A</p>
                      )}

                      <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                        <span className="font-medium">{_(msg`IP Address`)}:</span>{' '}
                        <span className="inline-block">
                          {logs.DOCUMENT_RECIPIENT_COMPLETED[0]?.ipAddress ?? _(msg`Unknown`)}
                        </span>
                      </p>

                      <p className="text-muted-foreground mt-1 text-sm print:text-xs">
                        <span className="font-medium">{_(msg`Device`)}:</span>{' '}
                        <span className="inline-block">
                          {getDevice(logs.DOCUMENT_RECIPIENT_COMPLETED[0]?.userAgent)}
                        </span>
                      </p>
                    </TableCell>

                    <TableCell truncate={false} className="w-[min-content] align-top">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-sm print:text-xs">
                          <span className="font-medium">{_(msg`Sent`)}:</span>{' '}
                          <span className="inline-block">
                            {logs.EMAIL_SENT[0]
                              ? DateTime.fromJSDate(logs.EMAIL_SENT[0].createdAt)
                                  .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                  .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')
                              : _(msg`Unknown`)}
                          </span>
                        </p>

                        <p className="text-muted-foreground text-sm print:text-xs">
                          <span className="font-medium">{_(msg`Viewed`)}:</span>{' '}
                          <span className="inline-block">
                            {logs.DOCUMENT_OPENED[0]
                              ? DateTime.fromJSDate(logs.DOCUMENT_OPENED[0].createdAt)
                                  .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                  .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')
                              : _(msg`Unknown`)}
                          </span>
                        </p>

                        {logs.DOCUMENT_RECIPIENT_REJECTED[0] ? (
                          <p className="text-muted-foreground text-sm print:text-xs">
                            <span className="font-medium">{_(msg`Rejected`)}:</span>{' '}
                            <span className="inline-block">
                              {logs.DOCUMENT_RECIPIENT_REJECTED[0]
                                ? DateTime.fromJSDate(logs.DOCUMENT_RECIPIENT_REJECTED[0].createdAt)
                                    .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                    .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')
                                : _(msg`Unknown`)}
                            </span>
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-sm print:text-xs">
                            <span className="font-medium">{_(msg`Signed`)}:</span>{' '}
                            <span className="inline-block">
                              {logs.DOCUMENT_RECIPIENT_COMPLETED[0]
                                ? DateTime.fromJSDate(
                                    logs.DOCUMENT_RECIPIENT_COMPLETED[0].createdAt,
                                  )
                                    .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                    .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')
                                : _(msg`Unknown`)}
                            </span>
                          </p>
                        )}

                        <p className="text-muted-foreground text-sm print:text-xs">
                          <span className="font-medium">{_(msg`Reason`)}:</span>{' '}
                          <span className="inline-block">
                            {recipient.signingStatus === SigningStatus.REJECTED
                              ? recipient.rejectionReason
                              : _(
                                  isOwner(recipient.email)
                                    ? FRIENDLY_SIGNING_REASONS['__OWNER__']
                                    : FRIENDLY_SIGNING_REASONS[recipient.role],
                                )}
                          </span>
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!hidePoweredBy && (
        <div className="my-8 flex-row-reverse space-y-4">
          <div className="flex items-end justify-end gap-x-4">
            <div
              className="flex h-24 w-24 justify-center"
              dangerouslySetInnerHTML={{
                __html: renderSVG(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${document.qrToken}`, {
                  ecc: 'Q',
                }),
              }}
            />
          </div>

          <div className="flex items-end justify-end gap-x-4">
            <p className="flex-shrink-0 text-sm font-medium print:text-xs">
              {_(msg`Signing certificate provided by`)}:
            </p>
            <BrandingLogo className="max-h-6 print:max-h-4" />
          </div>
        </div>
      )}
    </div>
  );
}
