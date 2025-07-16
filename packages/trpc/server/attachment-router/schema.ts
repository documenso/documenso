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

export const ZSetTemplateAttachmentsSchema = z.object({
  templateId: z.number(),
  attachments: z.array(
    z.object({
      id: z.string(),
      label: z.string().min(1, 'Label is required'),
      url: z.string().url('Invalid URL'),
      type: z.nativeEnum(AttachmentType),
    }),
  ),
});

export type TSetTemplateAttachmentsSchema = z.infer<typeof ZSetTemplateAttachmentsSchema>;

export const ZSetTemplateAttachmentsResponseSchema = z.array(
  z.object({
    id: z.string(),
    label: z.string(),
    url: z.string(),
    type: z.nativeEnum(AttachmentType),
  }),
);
