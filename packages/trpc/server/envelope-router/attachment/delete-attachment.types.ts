import { z } from 'zod';

export const ZDeleteAttachmentRequestSchema = z.object({
  id: z.string(),
});

export const ZDeleteAttachmentResponseSchema = z.void();

export type TDeleteAttachmentRequest = z.infer<typeof ZDeleteAttachmentRequestSchema>;
export type TDeleteAttachmentResponse = z.infer<typeof ZDeleteAttachmentResponseSchema>;
