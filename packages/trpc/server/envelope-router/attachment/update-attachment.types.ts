import { z } from 'zod';

export const ZUpdateAttachmentRequestSchema = z.object({
  id: z.string(),
  data: z.object({
    label: z.string().min(1, 'Label is required'),
    data: z.string().url('Must be a valid URL'),
  }),
});

export const ZUpdateAttachmentResponseSchema = z.void();

export type TUpdateAttachmentRequest = z.infer<typeof ZUpdateAttachmentRequestSchema>;
export type TUpdateAttachmentResponse = z.infer<typeof ZUpdateAttachmentResponseSchema>;
