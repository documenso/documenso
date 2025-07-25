import { z } from 'zod';

import { AttachmentType } from '@documenso/prisma/generated/types';

export const ZSetDocumentAttachmentsSchema = z.object({
  documentId: z.number(),
  attachments: z.array(
    z.object({
      id: z.string(),
      label: z.string().min(1, 'Label is required'),
      url: z.string().url('Invalid URL'),
      type: z.nativeEnum(AttachmentType),
    }),
  ),
});

export type TSetDocumentAttachmentsSchema = z.infer<typeof ZSetDocumentAttachmentsSchema>;

export const ZSetDocumentAttachmentsResponseSchema = z.array(
  z.object({
    id: z.string(),
    label: z.string(),
    url: z.string(),
    type: z.nativeEnum(AttachmentType),
  }),
);
