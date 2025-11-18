import { RecipientRole } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

export type SuggestedRecipient = {
  name: string;
  email?: string;
  role: 'SIGNER' | 'APPROVER' | 'CC';
  signingOrder?: number;
};

export const detectRecipientsInDocument = async (
  envelopeId: string,
): Promise<SuggestedRecipient[]> => {
  try {
    const response = await fetch('/api/ai/detect-recipients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ envelopeId }),
    });

    if (!response.ok) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to detect recipients',
      });
    }

    return (await response.json()) as SuggestedRecipient[];
  } catch (error) {
    throw AppError.parseError(error);
  }
};

export type RecipientForCreation = {
  name: string;
  email: string;
  role: RecipientRole;
  signingOrder?: number;
};

export const ensureRecipientEmails = (
  recipients: SuggestedRecipient[],
  envelopeId: string,
): RecipientForCreation[] => {
  const allowedRoles: RecipientRole[] = [
    RecipientRole.SIGNER,
    RecipientRole.APPROVER,
    RecipientRole.CC,
  ];

  return recipients.map((recipient) => {
    const email = recipient.email ?? '';

    const candidateRole = recipient.role as RecipientRole;
    const normalizedRole = allowedRoles.includes(candidateRole)
      ? candidateRole
      : RecipientRole.SIGNER;

    return {
      ...recipient,
      email,
      role: normalizedRole,
    };
  });
};
