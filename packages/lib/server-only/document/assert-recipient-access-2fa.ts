import { prisma } from '@documenso/prisma';
import type { Envelope, Recipient } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { TRecipientAccessAuth } from '../../types/document-auth';
import { DocumentAuth } from '../../types/document-auth';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { assertRateLimit } from '../rate-limit/rate-limit-middleware';
import { verifyAccess2FACodeRateLimit } from '../rate-limit/rate-limits';
import { isRecipientAuthorized } from './is-recipient-authorized';

export type AssertRecipientAccess2FAOptions = {
  envelope: Pick<Envelope, 'id' | 'authOptions'>;
  recipient: Pick<Recipient, 'id' | 'name' | 'email' | 'authOptions' | 'envelopeId'>;
  accessAuthOptions?: TRecipientAccessAuth;
  userId?: number;
  requestMetadata?: RequestMetadata;
};

/**
 * Throws unless the recipient passes the 2FA that their access auth requires before they complete the document.
 * Each code counts against a per-recipient attempt limit, so a wrong guess cannot be repeated without bound.
 * Writes a validated or failed audit log for each checked code.
 */
export const assertRecipientAccess2FA = async ({
  envelope,
  recipient,
  accessAuthOptions,
  userId,
  requestMetadata,
}: AssertRecipientAccess2FAOptions) => {
  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
    recipientAuth: recipient.authOptions,
  });

  if (
    !derivedRecipientAccessAuth.includes(DocumentAuth.TWO_FACTOR_AUTH) &&
    !derivedRecipientAccessAuth.includes(DocumentAuth.EXTERNAL_TWO_FACTOR_AUTH)
  ) {
    return;
  }

  if (!accessAuthOptions) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Access authentication required',
    });
  }

  if (!recipient.email.trim()) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Recipient ${recipient.id} requires an email because they have auth requirements.`,
    });
  }

  assertRateLimit(
    await verifyAccess2FACodeRateLimit.check({
      ip: requestMetadata?.ipAddress ?? 'unknown',
      identifier: String(recipient.id),
    }),
  );

  const isValid = await isRecipientAuthorized({
    type: 'ACCESS_2FA',
    documentAuthOptions: envelope.authOptions,
    recipient,
    userId, // Can be undefined for non-account recipients
    authOptions: accessAuthOptions,
  });

  const auditLogData = {
    recipientId: recipient.id,
    recipientName: recipient.name,
    recipientEmail: recipient.email,
  };

  if (!isValid) {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_FAILED,
        envelopeId: envelope.id,
        data: auditLogData,
      }),
    });

    throw new AppError(AppErrorCode.TWO_FACTOR_AUTH_FAILED, {
      message: 'Invalid 2FA authentication',
    });
  }

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_VALIDATED,
      envelopeId: envelope.id,
      data: auditLogData,
    }),
  });
};
