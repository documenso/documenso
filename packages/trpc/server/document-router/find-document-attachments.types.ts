import { z } from 'zod';

import { AttachmentType } from '@documenso/prisma/generated/types';

export const ZGetDocumentAttachmentsSchema = z.object({
  documentId: z.number(),
});

export const ZGetDocumentAttachmentsResponseSchema = z.array(
  z.object({
    id: z.string(),
    label: z.string(),
    url: z.string(),
    type: z.nativeEnum(AttachmentType),
  }),
);
