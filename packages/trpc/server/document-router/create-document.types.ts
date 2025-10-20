import { z } from 'zod';

import {
  ZDocumentExpiryAmountSchema,
  ZDocumentExpiryUnitSchema,
  ZDocumentMetaTimezoneSchema,
} from '@documenso/lib/types/document-meta';

import { ZDocumentTitleSchema } from './schema';

// Currently not in use until we allow passthrough documents on create.
// export const createDocumentMeta: TrpcRouteMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/document/create',
//     summary: 'Create document',
//     tags: ['Document'],
//   },
// };

export const ZCreateDocumentRequestSchema = z.object({
  title: ZDocumentTitleSchema,
  documentDataId: z.string().min(1),
  timezone: ZDocumentMetaTimezoneSchema.optional(),
  folderId: z.string().describe('The ID of the folder to create the document in').optional(),
  expiryAmount: ZDocumentExpiryAmountSchema.optional(),
  expiryUnit: ZDocumentExpiryUnitSchema.optional(),
});

export const ZCreateDocumentResponseSchema = z.object({
  legacyDocumentId: z.number(),
});

export type TCreateDocumentRequest = z.infer<typeof ZCreateDocumentRequestSchema>;
export type TCreateDocumentResponse = z.infer<typeof ZCreateDocumentResponseSchema>;
