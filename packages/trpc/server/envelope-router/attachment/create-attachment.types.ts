import { z } from 'zod';

export const ZCreateAttachmentRequestSchema = z.object({
  envelopeId: z.string(),
  data: z.object({
    label: z.string().min(1, 'Label is required'),
    data: z.string().url('Must be a valid URL'),
  }),
});

export const ZCreateAttachmentResponseSchema = z.void();

export type TCreateAttachmentRequest = z.infer<typeof ZCreateAttachmentRequestSchema>;
export type TCreateAttachmentResponse = z.infer<typeof ZCreateAttachmentResponseSchema>;
