import { RecipientRole } from '@prisma/client';

import { AppError } from '@documenso/lib/errors/app-error';

export type AiRecipient = {
  name: string;
  email?: string;
  role: 'SIGNER' | 'APPROVER' | 'CC';
  signingOrder?: number;
};

const sanitizeEmailLocalPart = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 32);
};

export const createPlaceholderRecipientEmail = (
  name: string,
  envelopeId: string,
  position: number,
) => {
  const normalizedName = sanitizeEmailLocalPart(name);
  const baseLocalPart = normalizedName ? `${normalizedName}.${position}` : `recipient-${position}`;
  const envelopeSuffix = envelopeId
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, 6);
  const suffix = envelopeSuffix ? `-${envelopeSuffix}` : '';

  return `${baseLocalPart}${suffix}@documenso.ai`;
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
  let recipientIndex = 1;
  const allowedRoles: RecipientRole[] = [
    RecipientRole.SIGNER,
    RecipientRole.APPROVER,
    RecipientRole.CC,
  ];

  return recipients.map((recipient) => {
    const email =
      recipient.email ??
      createPlaceholderRecipientEmail(recipient.name, envelopeId, recipientIndex);

    recipientIndex += 1;

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
