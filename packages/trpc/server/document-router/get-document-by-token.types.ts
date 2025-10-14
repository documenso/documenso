import { z } from 'zod';

import DocumentDataSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';

export const ZGetDocumentByTokenRequestSchema = z.object({
  token: z.string().min(1),
});

export const ZGetDocumentByTokenResponseSchema = z.object({
  documentData: DocumentDataSchema,
});

export type TGetDocumentByTokenRequest = z.infer<typeof ZGetDocumentByTokenRequestSchema>;
export type TGetDocumentByTokenResponse = z.infer<typeof ZGetDocumentByTokenResponseSchema>;
