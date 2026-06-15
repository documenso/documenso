import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc';

export const issueSigningTwoFactorTokenMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/signing-2fa/issue',
    summary: 'Issue a signing 2FA token',
    description:
      'Issue a one-time signing two-factor authentication token for a recipient. The caller is responsible for delivering the token to the signer through their own channel (e.g., SMS).',
    tags: ['Envelope'],
  },
};

export const ZIssueSigningTwoFactorTokenRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope.'),
  recipientId: z.number().describe('The ID of the recipient to issue the token for.'),
});

export const ZIssueSigningTwoFactorTokenResponseSchema = z.object({
  token: z.string().describe('The plaintext one-time token. Visible exactly once.'),
  tokenId: z.string().describe('The ID of the created token record.'),
  expiresAt: z.date().describe('When the token expires.'),
  ttlSeconds: z.number().describe('Token time-to-live in seconds.'),
  attemptLimit: z.number().describe('Maximum verification attempts allowed.'),
  issuedAt: z.date().describe('When the token was issued.'),
});

export type TIssueSigningTwoFactorTokenRequest = z.infer<
  typeof ZIssueSigningTwoFactorTokenRequestSchema
>;
export type TIssueSigningTwoFactorTokenResponse = z.infer<
  typeof ZIssueSigningTwoFactorTokenResponseSchema
>;
