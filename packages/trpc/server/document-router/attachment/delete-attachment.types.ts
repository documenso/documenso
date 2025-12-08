import { z } from 'zod';

import { ZSuccessResponseSchema } from '../../schema';

export const ZDeleteAttachmentRequestSchema = z.object({
  id: z.string(),
});

export const ZDeleteAttachmentResponseSchema = ZSuccessResponseSchema;

export type TDeleteAttachmentRequest = z.infer<typeof ZDeleteAttachmentRequestSchema>;
export type TDeleteAttachmentResponse = z.infer<typeof ZDeleteAttachmentResponseSchema>;
