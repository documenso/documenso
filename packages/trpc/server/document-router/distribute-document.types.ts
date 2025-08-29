import { z } from 'zod';

import { ZDocumentLiteSchema } from '@documenso/lib/types/document';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';

import type { TrpcRouteMeta } from '../trpc';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaDistributionMethodSchema,
  ZDocumentMetaLanguageSchema,
  ZDocumentMetaMessageSchema,
  ZDocumentMetaRedirectUrlSchema,
  ZDocumentMetaSubjectSchema,
  ZDocumentMetaTimezoneSchema,
} from './schema';

export const distributeDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/distribute',
    summary: 'Distribute document',
    description: 'Send the document out to recipients based on your distribution method',
    tags: ['Document'],
  },
};

export const ZDistributeDocumentRequestSchema = z.object({
  documentId: z.number().describe('The ID of the document to send.'),
  meta: z
    .object({
      subject: ZDocumentMetaSubjectSchema.optional(),
      message: ZDocumentMetaMessageSchema.optional(),
      timezone: ZDocumentMetaTimezoneSchema.optional(),
      dateFormat: ZDocumentMetaDateFormatSchema.optional(),
      distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
      redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
      language: ZDocumentMetaLanguageSchema.optional(),
      emailId: z.string().nullish(),
      emailReplyTo: z.string().email().nullish(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
    })
    .optional(),
});

export const ZDistributeDocumentResponseSchema = ZDocumentLiteSchema;

export type TDistributeDocumentRequest = z.infer<typeof ZDistributeDocumentRequestSchema>;
export type TDistributeDocumentResponse = z.infer<typeof ZDistributeDocumentResponseSchema>;
