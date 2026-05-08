import { z } from 'zod';

export const ZDownloadEnvelopeItemRequestParamsSchema = z.object({
  envelopeItemId: z.string().describe('The ID of the envelope item to download.'),
});

export const ZDownloadEnvelopeItemRequestQuerySchema = z.object({
  version: z
    .enum(['original', 'signed', 'pending'])
    .optional()
    .default('signed')
    .describe(
      'The version of the envelope item to download. "signed" returns the completed document with all signatures and the audit trail, "original" returns the original uploaded document, "pending" returns the original document with currently-inserted fields burned in (only valid while the envelope is in PENDING status; not a final executed document).',
    ),
});

export type TDownloadEnvelopeItemRequestParams = z.infer<typeof ZDownloadEnvelopeItemRequestParamsSchema>;

export type TDownloadEnvelopeItemRequestQuery = z.infer<typeof ZDownloadEnvelopeItemRequestQuerySchema>;

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
