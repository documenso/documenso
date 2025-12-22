import { z } from 'zod';

import { ZSuccessResponseSchema } from '../../schema';

export const ZUpdateAttachmentRequestSchema = z.object({
  id: z.string(),
  data: z.object({
    label: z.string().min(1, 'Label is required'),
    data: z.string().url('Must be a valid URL'),
  }),
});

export const ZUpdateAttachmentResponseSchema = ZSuccessResponseSchema;

export type TUpdateAttachmentRequest = z.infer<typeof ZUpdateAttachmentRequestSchema>;
export type TUpdateAttachmentResponse = z.infer<typeof ZUpdateAttachmentResponseSchema>;
