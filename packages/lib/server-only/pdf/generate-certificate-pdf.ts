import { PDF } from '@libpdf/core';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { DocumentMeta } from '@prisma/client';
import type { Envelope, Field, Recipient, Signature } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { prop, sortBy } from 'remeda';
import { match } from 'ts-pattern';

import { ZSupportedLanguageCodeSchema } from '../../constants/i18n';
import type { TDocumentAuditLogBaseSchema } from '../../types/document-audit-logs';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { getTranslations } from '../../utils/i18n';
import { getDocumentCertificateAuditLogs } from '../document/get-document-certificate-audit-logs';
import { getOrganisationClaimByTeamId } from '../organisation/get-organisation-claims';
import { renderCertificate } from './render-certificate';

export type GenerateCertificatePdfOptions = {
  envelope: Envelope & {
    documentMeta: DocumentMeta;
  };
  envelopeOwner: {
    name: string;
    email: string;
  };
  recipients: Recipient[];
  fields: (Pick<Field, 'id' | 'type' | 'secondaryId' | 'recipientId'> & {
    signature?: Pick<Signature, 'signatureImageAsBase64' | 'typedSignature'> | null;
  })[];
  language?: string;
  pageWidth: number;
  pageHeight: number;
};

export const generateCertificatePdf = async (options: GenerateCertificatePdfOptions) => {
  const { envelope, envelopeOwner, recipients, fields, language, pageWidth, pageHeight } = options;

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(language);

  const [organisationClaim, auditLogs, messages] = await Promise.all([
    getOrganisationClaimByTeamId({ teamId: envelope.teamId }),
    getDocumentCertificateAuditLogs({
      envelopeId: envelope.id,
    }),
    getTranslations(documentLanguage),
  ]);

  i18n.loadAndActivate({
    locale: documentLanguage,
    messages,
  });

  const payload = {
    recipients: recipients.map((recipient) => {
      const recipientId = recipient.id;

      const signatureField = fields.find(
        (field) => field.recipientId === recipient.id && field.type === FieldType.SIGNATURE,
      );

      const emailSent: TDocumentAuditLogBaseSchema | undefined = auditLogs['EMAIL_SENT'].find(
        (log) => log.type === 'EMAIL_SENT' && log.data.recipientId === recipientId,
      );

      const documentSent: TDocumentAuditLogBaseSchema | undefined = auditLogs['DOCUMENT_SENT'].find(
        (log) => log.type === 'DOCUMENT_SENT',
      );

      const documentOpened: TDocumentAuditLogBaseSchema | undefined = auditLogs[
        'DOCUMENT_OPENED'
      ].find((log) => log.type === 'DOCUMENT_OPENED' && log.data.recipientId === recipientId);

      const documentRecipientCompleted: TDocumentAuditLogBaseSchema | undefined = auditLogs[
        'DOCUMENT_RECIPIENT_COMPLETED'
      ].find(
        (log) =>
          log.type === 'DOCUMENT_RECIPIENT_COMPLETED' && log.data.recipientId === recipientId,
      );

      const documentRecipientRejected: TDocumentAuditLogBaseSchema | undefined = auditLogs[
        'DOCUMENT_RECIPIENT_REJECTED'
      ].find(
        (log) => log.type === 'DOCUMENT_RECIPIENT_REJECTED' && log.data.recipientId === recipientId,
      );

      const extractedAuthMethods = extractDocumentAuthMethods({
        documentAuth: envelope.authOptions,
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
        .with('ACCOUNT', () => i18n._(msg`Account Re-Authentication`))
        .with('TWO_FACTOR_AUTH', () => i18n._(msg`Two-Factor Re-Authentication`))
        .with('PASSWORD', () => i18n._(msg`Password Re-Authentication`))
        .with('PASSKEY', () => i18n._(msg`Passkey Re-Authentication`))
        .with('EXPLICIT_NONE', () => i18n._(msg`Email`))
        .with(undefined, () => null)
        .exhaustive();

      if (!authLevel) {
        const accessAuthMethod = extractedAuthMethods.derivedRecipientAccessAuth.at(0);

        authLevel = match(accessAuthMethod)
          .with('ACCOUNT', () => i18n._(msg`Account Authentication`))
          .with('TWO_FACTOR_AUTH', () => i18n._(msg`Two-Factor Authentication`))
          .with(undefined, () => i18n._(msg`Email`))
          .exhaustive();
      }

      return {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        signingStatus: recipient.signingStatus,
        signatureField,
        rejectionReason: recipient.rejectionReason,
        authLevel,
        logs: {
          emailed: emailSent ?? null,
          sent: documentSent ?? null,
          opened: documentOpened ?? null,
          completed: documentRecipientCompleted ?? null,
          rejected: documentRecipientRejected ?? null,
        },
      };
    }),
    envelopeOwner,
    qrToken: envelope.qrToken,
    hidePoweredBy: organisationClaim.flags.hidePoweredBy ?? false,
    pageWidth,
    pageHeight,
    i18n,
  };

  const certificatePages = await renderCertificate(payload);

  return await PDF.merge(certificatePages);
};
