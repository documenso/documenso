import { z } from 'zod';

/**
 * The context a QR signature session is created for.
 *
 * - `PROFILE_SIGNATURE`: a standalone signature, e.g. the profile or signup
 *   forms. Carries no additional data.
 * - `DOCUMENT_SIGNATURE`: a signature for a document signing flow. Carries the
 *   recipient token so the mobile page can render the document context.
 */
export const ZQrSignatureContextSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('PROFILE_SIGNATURE'),
  }),
  z.object({
    type: z.literal('DOCUMENT_SIGNATURE'),
    recipientToken: z.string().min(1).max(64),
  }),
]);

export type TQrSignatureContext = z.infer<typeof ZQrSignatureContextSchema>;

export type TQrSignatureContextType = TQrSignatureContext['type'];
