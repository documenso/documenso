import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc';

export const createAttachmentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/attachment/create',
    summary: 'Create attachment',
    description: 'Create a new attachment for an envelope',
    tags: ['Envelope Attachments'],
  },
};

export const ZCreateAttachmentRequestSchema = z.object({
  envelopeId: z.string(),
  data: z.object({
    label: z.string().min(1, 'Label is required'),
    data: z.string().url('Must be a valid URL'),
  }),
});

export const ZCreateAttachmentResponseSchema = z.object({
  id: z.string(),
});

export type TCreateAttachmentRequest = z.infer<typeof ZCreateAttachmentRequestSchema>;
export type TCreateAttachmentResponse = z.infer<typeof ZCreateAttachmentResponseSchema>;
