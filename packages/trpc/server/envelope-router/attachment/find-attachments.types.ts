import { z } from 'zod';

import { ZEnvelopeAttachmentTypeSchema } from '@documenso/lib/types/envelope-attachment';

export const ZFindAttachmentsRequestSchema = z.object({
  envelopeId: z.string(),
  token: z.string().optional(),
});

export const ZFindAttachmentsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      type: ZEnvelopeAttachmentTypeSchema,
      label: z.string(),
      data: z.string(),
    }),
  ),
});

export type TFindAttachmentsRequest = z.infer<typeof ZFindAttachmentsRequestSchema>;
export type TFindAttachmentsResponse = z.infer<typeof ZFindAttachmentsResponseSchema>;
