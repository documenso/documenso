import { DocumentDataType } from '@prisma/client';
import { z } from 'zod';

export const ZDocumentDataMetaSchema = z.object({
  // Could store other things such as PDF size, etc here.
  documentDataType: z.nativeEnum(DocumentDataType),
  pages: z
    .object({
      originalWidth: z.number().describe('Original PDF page width'),
      originalHeight: z.number().describe('Original PDF page height'),
      scale: z.number().describe('The scale applied to the width/height of the PDF page'),
      scaledWidth: z.number().describe('Scaled PDF page image width'),
      scaledHeight: z.number().describe('Scaled PDF page image height'),
    })
    .array(),
});

export type TDocumentDataMeta = z.infer<typeof ZDocumentDataMetaSchema>;

export type DocumentDataVersion = 'initial' | 'current';
