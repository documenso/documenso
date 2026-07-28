import { z } from 'zod';

export const ZGetQrSignatureSessionRequestSchema = z.object({
  token: z.string().min(1).max(64).describe('The QR signature session token'),
});

/**
 * The resolved context of a valid QR signature session.
 *
 * `NONE` is a session created without any context, in which case the mobile
 * page shows a generic "Signature requested".
 */
export const ZQrSignatureSessionContextSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('NONE'),
  }),
  z.object({
    type: z.literal('PROFILE_SIGNATURE'),
  }),
  z.object({
    type: z.literal('DOCUMENT_SIGNATURE'),
    documentTitle: z.string(),
    teamName: z.string(),
  }),
]);

export const ZGetQrSignatureSessionResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('EXPIRED'),
  }),
  z.object({
    status: z.literal('ALREADY_SUBMITTED'),
  }),
  z.object({
    // The session references a signing flow that no longer exists, or carries
    // malformed metadata.
    status: z.literal('INVALID'),
  }),
  z.object({
    status: z.literal('VALID'),
    context: ZQrSignatureSessionContextSchema,
  }),
]);

export type TGetQrSignatureSessionRequest = z.infer<typeof ZGetQrSignatureSessionRequestSchema>;
export type TGetQrSignatureSessionResponse = z.infer<typeof ZGetQrSignatureSessionResponseSchema>;
export type TQrSignatureSessionContext = z.infer<typeof ZQrSignatureSessionContextSchema>;
