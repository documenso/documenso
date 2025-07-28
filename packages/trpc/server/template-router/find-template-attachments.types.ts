import { z } from 'zod';

import { AttachmentType } from '@documenso/prisma/generated/types';

export const ZGetTemplateAttachmentsSchema = z.object({
  templateId: z.number(),
});

export const ZGetTemplateAttachmentsResponseSchema = z.array(
  z.object({
    id: z.string(),
    label: z.string(),
    url: z.string(),
    type: z.nativeEnum(AttachmentType),
  }),
);
