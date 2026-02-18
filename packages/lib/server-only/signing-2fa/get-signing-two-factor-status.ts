import { prisma } from '@documenso/prisma';

import { DocumentAuth } from '../../types/document-auth';
import { extractDocumentAuthMethods } from '../../utils/document-auth';

export type GetSigningTwoFactorStatusOptions = {
  recipientId: number;
  envelopeId: string;
  sessionId: string;
};

export type SigningTwoFactorStatus = {
  required: boolean;
  hasActiveToken: boolean;
  hasValidProof: boolean;
  tokenExpiresAt: Date | null;
  proofExpiresAt: Date | null;
  attemptsRemaining: number | null;
};

const NOT_REQUIRED_STATUS: SigningTwoFactorStatus = {
  required: false,
  hasActiveToken: false,
  hasValidProof: false,
  tokenExpiresAt: null,
  proofExpiresAt: null,
  attemptsRemaining: null,
};

export const getSigningTwoFactorStatus = async ({
  recipientId,
  envelopeId,
  sessionId,
}: GetSigningTwoFactorStatusOptions): Promise<SigningTwoFactorStatus> => {
  const envelope = await prisma.envelope.findFirst({
    where: { id: envelopeId },
    select: {
      authOptions: true,
      recipients: {
        where: { id: recipientId },
        select: {
          authOptions: true,
        },
      },
    },
  });

  if (!envelope || envelope.recipients.length === 0) {
    return NOT_REQUIRED_STATUS;
  }

  const [recipient] = envelope.recipients;

  const { derivedRecipientActionAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
    recipientAuth: recipient.authOptions,
  });

  const required = derivedRecipientActionAuth.includes(DocumentAuth.EXTERNAL_TWO_FACTOR_AUTH);

  if (!required) {
    return NOT_REQUIRED_STATUS;
  }

  const now = new Date();

  const [activeToken, validProof] = await Promise.all([
    prisma.signingTwoFactorToken.findFirst({
      where: {
        recipientId,
        envelopeId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        expiresAt: true,
        attempts: true,
        attemptLimit: true,
      },
    }),
    prisma.signingSessionTwoFactorProof.findFirst({
      where: {
        sessionId,
        recipientId,
        envelopeId,
        expiresAt: { gt: now },
      },
      select: {
        expiresAt: true,
      },
    }),
  ]);

  return {
    required: true,
    hasActiveToken: !!activeToken,
    hasValidProof: !!validProof,
    tokenExpiresAt: activeToken?.expiresAt ?? null,
    proofExpiresAt: validProof?.expiresAt ?? null,
    attemptsRemaining: activeToken
      ? Math.max(0, activeToken.attemptLimit - activeToken.attempts)
      : null,
  };
};
