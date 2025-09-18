import {
  type DocumentDistributionMethod,
  type DocumentSigningOrder,
  EnvelopeType,
} from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffDocumentMetaChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import type { SupportedLanguageCodes } from '../../constants/i18n';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentEmailSettings } from '../../types/document-email';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type CreateDocumentMetaOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  subject?: string;
  message?: string;
  timezone?: string;
  dateFormat?: string;
  redirectUrl?: string;
  emailId?: string | null;
  emailReplyTo?: string | null;
  emailSettings?: TDocumentEmailSettings;
  signingOrder?: DocumentSigningOrder;
  allowDictateNextSigner?: boolean;
  distributionMethod?: DocumentDistributionMethod;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
  language?: SupportedLanguageCodes;
  requestMetadata: ApiRequestMetadata;
};

export const updateDocumentMeta = async ({
  id,
  userId,
  teamId,
  subject,
  message,
  timezone,
  dateFormat,
  redirectUrl,
  signingOrder,
  allowDictateNextSigner,
  emailId,
  emailReplyTo,
  emailSettings,
  distributionMethod,
  typedSignatureEnabled,
  uploadSignatureEnabled,
  drawSignatureEnabled,
  language,
  requestMetadata,
}: CreateDocumentMetaOptions) => {
  const { envelopeWhereInput, team } = await getEnvelopeWhereInput({
    id,
    type: null, // Allow updating both documents and templates meta.
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      documentMeta: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const { documentMeta: originalDocumentMeta } = envelope;

  // Validate the emailId belongs to the organisation.
  if (emailId) {
    const email = await prisma.organisationEmail.findFirst({
      where: {
        id: emailId,
        organisationId: team.organisationId,
      },
    });

    if (!email) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email not found',
      });
    }
  }

  return await prisma.$transaction(async (tx) => {
    const upsertedDocumentMeta = await tx.documentMeta.update({
      where: {
        id: envelope.documentMetaId,
      },
      data: {
        subject,
        message,
        dateFormat,
        timezone,
        redirectUrl,
        signingOrder,
        allowDictateNextSigner,
        emailId,
        emailReplyTo,
        emailSettings,
        distributionMethod,
        typedSignatureEnabled,
        uploadSignatureEnabled,
        drawSignatureEnabled,
        language,
      },
    });

    const changes = diffDocumentMetaChanges(originalDocumentMeta ?? {}, upsertedDocumentMeta);

    // Create audit logs only for document type envelopes.
    if (changes.length > 0 && envelope.type === EnvelopeType.DOCUMENT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED,
          envelopeId: envelope.id,
          metadata: requestMetadata,
          data: {
            changes: diffDocumentMetaChanges(originalDocumentMeta ?? {}, upsertedDocumentMeta),
          },
        }),
      });
    }

    return upsertedDocumentMeta;
  });
};
