import { z } from 'zod';

export const ZDownloadEnvelopeItemRequestParamsSchema = z.object({
  envelopeItemId: z.string().describe('The ID of the envelope item to download.'),
  version: z
    .enum(['original', 'signed'])
    .optional()
    .default('signed')
    .describe(
      'The version of the envelope item to download. "signed" returns the completed document with signatures, "original" returns the original uploaded document.',
    ),
});

export type TDownloadEnvelopeItemRequestParams = z.infer<
  typeof ZDownloadEnvelopeItemRequestParamsSchema
>;

export const ZDownloadDocumentRequestParamsSchema = z.object({
  documentId: z.coerce.number().describe('The ID of the document to download.'),
  version: z
    .enum(['original', 'signed'])
    .optional()
    .default('signed')
    .describe(
      'The version of the document to download. "signed" returns the completed document with signatures, "original" returns the original uploaded document.',
    ),
});

export type TDownloadDocumentRequestParams = z.infer<typeof ZDownloadDocumentRequestParamsSchema>;
