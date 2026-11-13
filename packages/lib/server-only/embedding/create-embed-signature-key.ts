import { createHash } from 'node:crypto';

export type CreateEmbedSignatureKeyOptions = {
  organisationId: string;
  email: string;
  clientUserId: string;
};

// Hashed so the stored row contains neither the recipient's email nor the
// embedder's identifier.
export const createEmbedSignatureKey = ({ organisationId, email, clientUserId }: CreateEmbedSignatureKeyOptions) => {
  const normalisedEmail = email.trim().toLowerCase();

  return createHash('sha256').update(`${organisationId}:${normalisedEmail}:${clientUserId}`).digest('hex');
};
