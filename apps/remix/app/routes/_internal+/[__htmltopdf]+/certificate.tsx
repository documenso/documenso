import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { APP_I18N_OPTIONS, ZSupportedLanguageCodeSchema } from '@documenso/lib/constants/i18n';
import { RECIPIENT_ROLE_SIGNING_REASONS, RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { unsafeGetEntireEnvelope } from '@documenso/lib/server-only/admin/get-entire-document';
import { decryptSecondaryData } from '@documenso/lib/server-only/crypto/decrypt';
import { getDocumentCertificateAuditLogs } from '@documenso/lib/server-only/document/get-document-certificate-audit-logs';
import { getOrganisationClaimByTeamId } from '@documenso/lib/server-only/organisation/get-organisation-claims';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { getTranslations } from '@documenso/lib/utils/i18n';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { EnvelopeType, FieldType, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { redirect } from 'react-router';
import { prop, sortBy } from 'remeda';
import { match } from 'ts-pattern';
import { UAParser } from 'ua-parser-js';
import { renderSVG } from 'uqr';

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

  const auditLogs = await getDocumentCertificateAuditLogs({
    envelopeId: envelope.id,
  });

  const messages = await getTranslations(documentLanguage);

  return {
    document: {
      id: mapSecondaryIdToDocumentId(envelope.secondaryId),
      title: envelope.title,
      status: envelope.status,
      user: {
        name: envelope.user.name,
        email: envelope.user.email,
      },
      qrToken: envelope.qrToken,
      authOptions: envelope.authOptions,
      recipients: envelope.recipients,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
      deletedAt: envelope.deletedAt,
      documentMeta: envelope.documentMeta,
    },
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

    const insertedAuditLogsWithFieldAuth = sortBy(
      auditLogs.DOCUMENT_FIELD_INSERTED.filter(
        (log) => log.data.recipientId === recipient.id && log.data.fieldSecurity,
      ),
      [prop('createdAt'), 'desc'],
    );

    const actionAuthMethod = insertedAuditLogsWithFieldAuth.at(0)?.data?.fieldSecurity?.type;

    let authLevel = match(actionAuthMethod)
      .with('ACCOUNT', () => _(msg`Account Re-Authentication`))
      .with('TWO_FACTOR_AUTH', () => _(msg`Two-Factor Re-Authentication`))
      .with('PASSWORD', () => _(msg`Password Re-Authentication`))
      .with('PASSKEY', () => _(msg`Passkey Re-Authentication`))
      .with('EXPLICIT_NONE', () => _(msg`Email`))
      .with(undefined, () => null)
      .exhaustive();

    if (!authLevel) {
      const accessAuthMethod = extractedAuthMethods.derivedRecipientAccessAuth.at(0);

      authLevel = match(accessAuthMethod)
        .with('ACCOUNT', () => _(msg`Account Authentication`))
        .with('TWO_FACTOR_AUTH', () => _(msg`Two-Factor Authentication`))
        .with(undefined, () => _(msg`Email`))
        .exhaustive();
    }

    return authLevel;
  };

  const getRecipientAuditLogs = (recipientId: number) => {
    return {
      [DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT]: auditLogs[DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT].filter(
        (log) => log.type === DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT && log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT]: auditLogs[DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT].filter(
        (log) => log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED]: auditLogs[DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED].filter(
        (log) => log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED && log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED && log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED && log.data.recipientId === recipientId,
      ),
    };
  };

  const getRecipientSignatureField = (recipientId: number) => {
    return document.recipients
      .find((recipient) => recipient.id === recipientId)
      ?.fields.find((field) => field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE);
  };

  return (
    <div className="print-provider pointer-events-none mx-auto max-w-screen-md">
      <header>
        <h1 className="font-semibold text-lg tracking-tight">{_(msg`Signing Certificate`)}</h1>

        <p className="mt-1 text-pretty text-muted-foreground text-sm">{document.title}</p>
      </header>

      <table className="mt-6 w-full">
        <thead>
          <tr className="border-border border-b">
            <th className="w-[30%] pr-4 pb-2 text-left font-medium text-muted-foreground text-xs">
              {_(msg`Signer Events`)}
            </th>

            <th className="w-[30%] pr-4 pb-2 text-left font-medium text-muted-foreground text-xs">
              {_(msg`Signature`)}
            </th>

            <th className="pb-2 text-left font-medium text-muted-foreground text-xs">{_(msg`Details`)}</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {document.recipients.map((recipient, i) => {
            const logs = getRecipientAuditLogs(recipient.id);
            const signature = getRecipientSignatureField(recipient.id);
            const isRejected = Boolean(logs.DOCUMENT_RECIPIENT_REJECTED[0]);

            return (
              <tr key={i} className="align-top print:break-inside-avoid">
                <td className="py-3 pr-4">
                  <div className="hyphens-auto break-words font-medium text-sm print:text-xs">{recipient.name}</div>

                  <div className="break-all text-muted-foreground text-xs">{recipient.email}</div>

                  <div className="mt-0.5 text-muted-foreground text-xs">
                    {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                  </div>

                  <div className="mt-2.5">
                    <div className="font-medium text-muted-foreground text-xs">{_(msg`Authentication Level`)}</div>

                    <div className="mt-0.5 text-foreground text-sm print:text-xs">
                      {getAuthenticationLevel(recipient.id)}
                    </div>
                  </div>
                </td>

                <td className="py-3 pr-4">
                  {signature ? (
                    <div className="space-y-2.5">
                      {!isRejected && (
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
                            <p className="text-center font-signature text-sm">{signature.signature?.typedSignature}</p>
                          )}
                        </div>
                      )}

                      <div>
                        <div className="font-medium text-muted-foreground text-xs">{_(msg`Signature ID`)}</div>

                        <div className="mt-0.5 break-all font-mono text-xs uppercase">{signature.secondaryId}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm print:text-xs">{_(msg`N/A`)}</p>
                  )}

                  <div className="mt-2.5">
                    <div className="font-medium text-muted-foreground text-xs">{_(msg`IP Address`)}</div>

                    <div className="mt-0.5 text-foreground text-sm print:text-xs">
                      {logs.DOCUMENT_RECIPIENT_COMPLETED[0]?.ipAddress ?? _(msg`Unknown`)}
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <div className="font-medium text-muted-foreground text-xs">{_(msg`Device`)}</div>

                    <div className="mt-0.5 text-foreground text-sm print:text-xs">
                      {getDevice(logs.DOCUMENT_RECIPIENT_COMPLETED[0]?.userAgent)}
                    </div>
                  </div>
                </td>

                <td className="py-3">
                  <div className="space-y-2.5">
                    <div>
                      <div className="font-medium text-muted-foreground text-xs">{_(msg`Sent`)}</div>

                      <div className="mt-0.5 text-foreground text-sm print:text-xs">
                        {logs.EMAIL_SENT[0]
                          ? DateTime.fromJSDate(logs.EMAIL_SENT[0].createdAt)
                              .setLocale(APP_I18N_OPTIONS.defaultLocale)
                              .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')
                          : logs.DOCUMENT_SENT[0]
                            ? DateTime.fromJSDate(logs.DOCUMENT_SENT[0].createdAt)
                                .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')
                            : _(msg`Unknown`)}
                      </div>
                    </div>

                    <div>
                      <div className="font-medium text-muted-foreground text-xs">{_(msg`Viewed`)}</div>

                      <div className="mt-0.5 text-foreground text-sm print:text-xs">
                        {logs.DOCUMENT_OPENED[0]
                          ? DateTime.fromJSDate(logs.DOCUMENT_OPENED[0].createdAt)
                              .setLocale(APP_I18N_OPTIONS.defaultLocale)
                              .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')
                          : _(msg`Unknown`)}
                      </div>
                    </div>

                    {logs.DOCUMENT_RECIPIENT_REJECTED[0] ? (
                      <div>
                        <div className="font-medium text-red-600 text-xs">{_(msg`Rejected`)}</div>

                        <div className="mt-0.5 text-red-600 text-sm print:text-xs">
                          {DateTime.fromJSDate(logs.DOCUMENT_RECIPIENT_REJECTED[0].createdAt)
                            .setLocale(APP_I18N_OPTIONS.defaultLocale)
                            .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium text-muted-foreground text-xs">{_(msg`Signed`)}</div>

                        <div className="mt-0.5 text-foreground text-sm print:text-xs">
                          {logs.DOCUMENT_RECIPIENT_COMPLETED[0]
                            ? DateTime.fromJSDate(logs.DOCUMENT_RECIPIENT_COMPLETED[0].createdAt)
                                .setLocale(APP_I18N_OPTIONS.defaultLocale)
                                .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)')
                            : _(msg`Unknown`)}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="font-medium text-muted-foreground text-xs">{_(msg`Reason`)}</div>

                      <div className="mt-0.5 text-foreground text-sm print:text-xs">
                        {recipient.signingStatus === SigningStatus.REJECTED
                          ? recipient.rejectionReason
                          : _(
                              isOwner(recipient.email)
                                ? FRIENDLY_SIGNING_REASONS['__OWNER__']
                                : FRIENDLY_SIGNING_REASONS[recipient.role],
                            )}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

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
            <p className="flex-shrink-0 font-medium text-muted-foreground text-xs">
              {_(msg`Signing certificate provided by`)}:
            </p>
            <BrandingLogo className="max-h-6 print:max-h-4" />
          </div>
        </div>
      )}
    </div>
  );
}
