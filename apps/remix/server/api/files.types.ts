import { z } from 'zod';

import DocumentDataSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';

export const ZUploadPdfRequestSchema = z.object({
  file: z.instanceof(File),
});

export const ZUploadPdfResponseSchema = DocumentDataSchema.pick({
  type: true,
  id: true,
});

export type TUploadPdfRequest = z.infer<typeof ZUploadPdfRequestSchema>;
export type TUploadPdfResponse = z.infer<typeof ZUploadPdfResponseSchema>;

export const ZGetPresignedPostUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const ZGetPresignedPostUrlResponseSchema = z.object({
  key: z.string().min(1),
  url: z.string().min(1),
});

export const ZGetPresignedGetUrlRequestSchema = z.object({
  key: z.string().min(1),
});

export const ZGetPresignedGetUrlResponseSchema = z.object({
  url: z.string().min(1),
});

export type TGetPresignedPostUrlRequest = z.infer<typeof ZGetPresignedPostUrlRequestSchema>;
export type TGetPresignedPostUrlResponse = z.infer<typeof ZGetPresignedPostUrlResponseSchema>;
export type TGetPresignedGetUrlRequest = z.infer<typeof ZGetPresignedGetUrlRequestSchema>;
export type TGetPresignedGetUrlResponse = z.infer<typeof ZGetPresignedGetUrlResponseSchema>;
