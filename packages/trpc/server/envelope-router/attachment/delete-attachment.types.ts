import { z } from 'zod';

import { ZSuccessResponseSchema } from '../../schema';
import type { TrpcRouteMeta } from '../../trpc';

export const deleteAttachmentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/attachment/delete',
    summary: 'Delete attachment',
    description: 'Delete an attachment from an envelope',
    tags: ['Envelope Attachments'],
  },
};

export const ZDeleteAttachmentRequestSchema = z.object({
  id: z.string(),
});

export const ZDeleteAttachmentResponseSchema = ZSuccessResponseSchema;

export type TDeleteAttachmentRequest = z.infer<typeof ZDeleteAttachmentRequestSchema>;
export type TDeleteAttachmentResponse = z.infer<typeof ZDeleteAttachmentResponseSchema>;
