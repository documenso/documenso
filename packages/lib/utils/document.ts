import type {
  Document,
  DocumentMeta,
  OrganisationGlobalSettings,
  TemplateMeta,
} from '@prisma/client';
import { DocumentDistributionMethod, DocumentSigningOrder, DocumentStatus } from '@prisma/client';

import { DEFAULT_DOCUMENT_TIME_ZONE } from '../constants/time-zones';
import { DEFAULT_DOCUMENT_EMAIL_SETTINGS } from '../types/document-email';

export const isDocumentCompleted = (document: Pick<Document, 'status'> | DocumentStatus) => {
  const status = typeof document === 'string' ? document : document.status;

  return status === DocumentStatus.COMPLETED || status === DocumentStatus.REJECTED;
};

/**
 * Extracts the derived document meta which should be used when creating a document
 * from scratch, or from a template.
 *
 * Uses the following, the lower number overrides the higher number:
 * 1. Merged organisation/team settings
 * 2. Meta overrides
 *
 * @param settings - The merged organisation/team settings.
 * @param overrideMeta - The meta to override the settings with.
 * @returns The derived document meta.
 */
export const extractDerivedDocumentMeta = (
  settings: Omit<OrganisationGlobalSettings, 'id'>,
  overrideMeta: Partial<DocumentMeta | TemplateMeta> | undefined | null,
) => {
  const meta = overrideMeta ?? {};

  // Note: If you update this you will also need to update `create-document-from-template.ts`
  // since there is custom work there which allows 3 overrides.
  return {
    language: meta.language || settings.documentLanguage,
    timezone: meta.timezone || settings.documentTimezone || DEFAULT_DOCUMENT_TIME_ZONE,
    dateFormat: meta.dateFormat || settings.documentDateFormat,
    message: meta.message || null,
    subject: meta.subject || null,
    password: meta.password || null,
    redirectUrl: meta.redirectUrl || null,

    signingOrder: meta.signingOrder || DocumentSigningOrder.PARALLEL,
    allowDictateNextSigner: meta.allowDictateNextSigner ?? false,
    distributionMethod: meta.distributionMethod || DocumentDistributionMethod.EMAIL, // Todo: Make this a setting.

    // Signature settings.
    typedSignatureEnabled: meta.typedSignatureEnabled ?? settings.typedSignatureEnabled,
    uploadSignatureEnabled: meta.uploadSignatureEnabled ?? settings.uploadSignatureEnabled,
    drawSignatureEnabled: meta.drawSignatureEnabled ?? settings.drawSignatureEnabled,

    // Email settings.
    emailId: meta.emailId ?? settings.emailId,
    emailReplyTo: meta.emailReplyTo ?? settings.emailReplyTo,
    emailSettings:
      meta.emailSettings || settings.emailDocumentSettings || DEFAULT_DOCUMENT_EMAIL_SETTINGS,
  } satisfies Omit<DocumentMeta, 'id' | 'documentId'>;
};
