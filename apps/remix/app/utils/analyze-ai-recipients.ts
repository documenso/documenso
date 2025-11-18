import { RecipientRole } from '@prisma/client';

import { AppError } from '@documenso/lib/errors/app-error';

export type AiRecipient = {
  name: string;
  email?: string;
  role: 'SIGNER' | 'APPROVER' | 'CC';
  signingOrder?: number;
};

export const analyzeRecipientsFromDocument = async (envelopeId: string): Promise<AiRecipient[]> => {
  try {
    const response = await fetch('/api/ai/analyze-recipients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ envelopeId }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze recipients');
    }

    return (await response.json()) as AiRecipient[];
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
  recipients: AiRecipient[],
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
