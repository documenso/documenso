import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { DocumentAuth } from '../../types/document-auth';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { generateSigningTwoFactorToken, generateTokenSalt, hashToken } from './token-utils';

const TOKEN_TTL_MINUTES = 10;
const DEFAULT_ATTEMPT_LIMIT = 5;

export const SIGNING_2FA_REASON_CODES = {
  TWO_FA_NOT_REQUIRED: 'TWO_FA_NOT_REQUIRED',
  TWO_FA_RECIPIENT_INELIGIBLE: 'TWO_FA_RECIPIENT_INELIGIBLE',
  TWO_FA_ISSUER_FORBIDDEN: 'TWO_FA_ISSUER_FORBIDDEN',
} as const;

export type IssueSigningTwoFactorTokenOptions = {
  recipientId: number;
  envelopeId: string;
  apiTokenId: number;
};

export const issueSigningTwoFactorToken = async ({
  recipientId,
  envelopeId,
  apiTokenId,
}: IssueSigningTwoFactorTokenOptions) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      type: EnvelopeType.DOCUMENT,
    },
    include: {
      recipients: {
        where: {
          id: recipientId,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
      statusCode: 404,
    });
  }

  if (envelope.status !== DocumentStatus.PENDING) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document must be in PENDING status`,
      statusCode: 400,
    });
  }

  if (envelope.recipients.length === 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found for this document',
      statusCode: 404,
    });
  }

  const [recipient] = envelope.recipients;

  const { derivedRecipientActionAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
    recipientAuth: recipient.authOptions,
  });

  const requiresExternal2FA = derivedRecipientActionAuth.includes(
    DocumentAuth.EXTERNAL_TWO_FACTOR_AUTH,
  );

  if (!requiresExternal2FA) {
    await throwIssuanceDenied({
      envelopeId,
      recipient,
      reasonCode: SIGNING_2FA_REASON_CODES.TWO_FA_NOT_REQUIRED,
    });
  }

  if (recipient.signingStatus === 'SIGNED') {
    await throwIssuanceDenied({
      envelopeId,
      recipient,
      reasonCode: SIGNING_2FA_REASON_CODES.TWO_FA_RECIPIENT_INELIGIBLE,
    });
  }

  const plaintextToken = generateSigningTwoFactorToken();
  const salt = generateTokenSalt();
  const tokenHash = hashToken(plaintextToken, salt);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    await tx.signingTwoFactorToken.updateMany({
      where: {
        recipientId,
        envelopeId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    const newToken = await tx.signingTwoFactorToken.create({
      data: {
        recipientId,
        envelopeId,
        tokenHash,
        tokenSalt: salt,
        expiresAt,
        attemptLimit: DEFAULT_ATTEMPT_LIMIT,
        issuedByApiTokenId: apiTokenId,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.EXTERNAL_2FA_TOKEN_ISSUED,
        envelopeId,
        data: {
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          tokenId: newToken.id,
        },
      }),
    });

    return newToken;
  });

  return {
    token: plaintextToken,
    tokenId: result.id,
    expiresAt: result.expiresAt,
    ttlSeconds: TOKEN_TTL_MINUTES * 60,
    attemptLimit: result.attemptLimit,
    issuedAt: result.createdAt,
  };
};

const throwIssuanceDenied = async ({
  envelopeId,
  recipient,
  reasonCode,
}: {
  envelopeId: string;
  recipient: { id: number; email: string; name: string | null };
  reasonCode: string;
}) => {
  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.EXTERNAL_2FA_TOKEN_ISSUE_DENIED,
      envelopeId,
      data: {
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name ?? '',
        reasonCode,
      },
    }),
  });

  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: reasonCode,
    statusCode: 400,
  });
};
