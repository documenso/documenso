import { z } from 'zod';

import { ZSuccessResponseSchema } from '../../schema';
import type { TrpcRouteMeta } from '../../trpc';

export const updateAttachmentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/attachment/update',
    summary: 'Update attachment',
    description: 'Update an existing attachment',
    tags: ['Envelope Attachments'],
  },
};

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
