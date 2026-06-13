import { prisma } from '@documenso/prisma';

import { SIGNING_2FA_VERIFY_REASON_CODES } from '../../constants/document-auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { verifyTokenHash } from './token-utils';

export { SIGNING_2FA_VERIFY_REASON_CODES };

const PROOF_TTL_MINUTES = 10;

export type VerifySigningTwoFactorTokenOptions = {
  recipientId: number;
  envelopeId: string;
  token: string;
  sessionId: string;
};

export const verifySigningTwoFactorToken = async ({
  recipientId,
  envelopeId,
  token: plaintextToken,
  sessionId,
}: VerifySigningTwoFactorTokenOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      envelopeId,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
      statusCode: 404,
    });
  }

  const activeToken = await prisma.signingTwoFactorToken.findFirst({
    where: {
      recipientId,
      envelopeId,
      status: 'ACTIVE',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!activeToken) {
    await throwVerificationError({
      envelopeId,
      recipient,
      tokenId: 'none',
      reasonCode: SIGNING_2FA_VERIFY_REASON_CODES.TWO_FA_NOT_ISSUED,
      attemptsUsed: 0,
      attemptLimit: 0,
      errorCode: AppErrorCode.INVALID_REQUEST,
      statusCode: 400,
    });
    return;
  }

  if (activeToken.expiresAt < new Date()) {
    await prisma.signingTwoFactorToken.update({
      where: { id: activeToken.id },
      data: {
        status: 'EXPIRED',
      },
    });

    await throwVerificationError({
      envelopeId,
      recipient,
      tokenId: activeToken.id,
      reasonCode: SIGNING_2FA_VERIFY_REASON_CODES.TWO_FA_TOKEN_EXPIRED,
      attemptsUsed: activeToken.attempts,
      attemptLimit: activeToken.attemptLimit,
      errorCode: AppErrorCode.EXPIRED_CODE,
      statusCode: 400,
    });
    return;
  }

  if (activeToken.attempts >= activeToken.attemptLimit) {
    await prisma.signingTwoFactorToken.update({
      where: { id: activeToken.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    await throwVerificationError({
      envelopeId,
      recipient,
      tokenId: activeToken.id,
      reasonCode: SIGNING_2FA_VERIFY_REASON_CODES.TWO_FA_ATTEMPT_LIMIT_REACHED,
      attemptsUsed: activeToken.attempts,
      attemptLimit: activeToken.attemptLimit,
      errorCode: AppErrorCode.TOO_MANY_REQUESTS,
      statusCode: 429,
    });
    return;
  }

  const isValid = verifyTokenHash(plaintextToken, activeToken.tokenSalt, activeToken.tokenHash);

  if (!isValid) {
    const updatedToken = await prisma.signingTwoFactorToken.update({
      where: { id: activeToken.id },
      data: {
        attempts: { increment: 1 },
      },
    });

    await throwVerificationError({
      envelopeId,
      recipient,
      tokenId: activeToken.id,
      reasonCode: SIGNING_2FA_VERIFY_REASON_CODES.TWO_FA_TOKEN_INVALID,
      attemptsUsed: updatedToken.attempts,
      attemptLimit: updatedToken.attemptLimit,
      errorCode: AppErrorCode.INVALID_REQUEST,
      statusCode: 400,
    });
    return;
  }

  const proofExpiresAt = new Date(Date.now() + PROOF_TTL_MINUTES * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    await tx.signingTwoFactorToken.update({
      where: { id: activeToken.id },
      data: {
        status: 'CONSUMED',
        consumedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    const proof = await tx.signingSessionTwoFactorProof.upsert({
      where: {
        sessionId_recipientId_envelopeId: {
          sessionId,
          recipientId,
          envelopeId,
        },
      },
      create: {
        sessionId,
        recipientId,
        envelopeId,
        expiresAt: proofExpiresAt,
      },
      update: {
        verifiedAt: new Date(),
        expiresAt: proofExpiresAt,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.EXTERNAL_2FA_TOKEN_VERIFY_SUCCEEDED,
        envelopeId,
        data: {
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          tokenId: activeToken.id,
        },
      }),
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.EXTERNAL_2FA_TOKEN_CONSUMED,
        envelopeId,
        data: {
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          tokenId: activeToken.id,
        },
      }),
    });

    return proof;
  });

  return {
    verified: true,
    proofId: result.id,
    expiresAt: result.expiresAt,
  };
};

type ThrowVerificationErrorOptions = {
  envelopeId: string;
  recipient: { id: number; email: string; name: string };
  tokenId: string;
  reasonCode: string;
  attemptsUsed: number;
  attemptLimit: number;
  errorCode: AppErrorCode;
  statusCode: number;
};

const throwVerificationError = async ({
  envelopeId,
  recipient,
  tokenId,
  reasonCode,
  attemptsUsed,
  attemptLimit,
  errorCode,
  statusCode,
}: ThrowVerificationErrorOptions): Promise<never> => {
  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.EXTERNAL_2FA_TOKEN_VERIFY_FAILED,
      envelopeId,
      data: {
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        tokenId,
        reasonCode,
        attemptsUsed,
        attemptLimit,
      },
    }),
  });

  throw new AppError(errorCode, {
    message: reasonCode,
    statusCode,
  });
};
