import DocumentDataSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import { z } from 'zod';

export const ZUploadPdfRequestSchema = z.object({
  file: z.instanceof(File),
});

export const ZUploadPdfResponseSchema = DocumentDataSchema.pick({
  type: true,
  id: true,
});

export type TUploadPdfRequest = z.infer<typeof ZUploadPdfRequestSchema>;
export type TUploadPdfResponse = z.infer<typeof ZUploadPdfResponseSchema>;

export const ALLOWED_UPLOAD_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;

export const isAllowedUploadContentType = (contentType: string): boolean => {
  const normalizedContentType = contentType.split(';').at(0)?.trim().toLowerCase();

  return ALLOWED_UPLOAD_CONTENT_TYPES.some((allowed) => allowed === normalizedContentType);
};

export const ZGetPresignedPostUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const ZGetPresignedPostUrlResponseSchema = z.object({
  key: z.string().min(1),
  url: z.string().min(1),
});

export type TGetPresignedPostUrlRequest = z.infer<typeof ZGetPresignedPostUrlRequestSchema>;
export type TGetPresignedPostUrlResponse = z.infer<typeof ZGetPresignedPostUrlResponseSchema>;

export const ZGetEnvelopeItemFileRequestParamsSchema = z.object({
  envelopeId: z.string().min(1),
  envelopeItemId: z.string().min(1),
});

export type TGetEnvelopeItemFileRequestParams = z.infer<typeof ZGetEnvelopeItemFileRequestParamsSchema>;

export const ZGetEnvelopeItemFileRequestQuerySchema = z.object({
  token: z.string().optional(),
});

export type TGetEnvelopeItemFileRequestQuery = z.infer<typeof ZGetEnvelopeItemFileRequestQuerySchema>;

export const ZGetEnvelopeItemFileTokenRequestParamsSchema = z.object({
  token: z.string().min(1),
  envelopeItemId: z.string().min(1),
});

export type TGetEnvelopeItemFileTokenRequestParams = z.infer<typeof ZGetEnvelopeItemFileTokenRequestParamsSchema>;

export const ZGetEnvelopeItemFileDownloadRequestParamsSchema = z.object({
  envelopeId: z.string().min(1),
  envelopeItemId: z.string().min(1),
  version: z.enum(['signed', 'original', 'pending']).default('signed'),
});

export type TGetEnvelopeItemFileDownloadRequestParams = z.infer<typeof ZGetEnvelopeItemFileDownloadRequestParamsSchema>;

export const ZGetEnvelopeItemFileTokenDownloadRequestParamsSchema = z.object({
  token: z.string().min(1),
  envelopeItemId: z.string().min(1),
  version: z.enum(['signed', 'original']).default('signed'),
});

export type TGetEnvelopeItemFileTokenDownloadRequestParams = z.infer<
  typeof ZGetEnvelopeItemFileTokenDownloadRequestParamsSchema
>;
