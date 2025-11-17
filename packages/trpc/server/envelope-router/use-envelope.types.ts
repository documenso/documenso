import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaDistributionMethodSchema,
  ZDocumentMetaDrawSignatureEnabledSchema,
  ZDocumentMetaLanguageSchema,
  ZDocumentMetaMessageSchema,
  ZDocumentMetaRedirectUrlSchema,
  ZDocumentMetaSubjectSchema,
  ZDocumentMetaTimezoneSchema,
  ZDocumentMetaTypedSignatureEnabledSchema,
  ZDocumentMetaUploadSignatureEnabledSchema,
} from '@documenso/lib/types/document-meta';
import { ZEnvelopeAttachmentTypeSchema } from '@documenso/lib/types/envelope-attachment';
import { ZFieldMetaPrefillFieldsSchema } from '@documenso/lib/types/field-meta';

import { zodFormData } from '../../utils/zod-form-data';
import type { TrpcRouteMeta } from '../trpc';
import { ZRecipientWithSigningUrlSchema } from './schema';

export const useEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/use',
    contentTypes: ['multipart/form-data'],
    summary: 'Use envelope',
    description:
      'Create a document envelope from a template envelope. Upload custom files to replace the template PDFs and map them to specific envelope items using identifiers.',
    tags: ['Envelope'],
  },
};

export const ZUseEnvelopePayloadSchema = z.object({
  envelopeId: z.string().describe('The ID of the template envelope to use.'),
  externalId: z.string().optional().describe('External ID for the created document.'),
  recipients: z
    .array(
      z.object({
        id: z.number().describe('The ID of the recipient in the template.'),
        email: z.string().email().max(254),
        name: z.string().max(255).optional(),
        signingOrder: z.number().optional(),
      }),
    )
    .describe('The information of the recipients to create the document with.')
    .optional(),
  distributeDocument: z
    .boolean()
    .describe('Whether to create the document as pending and distribute it to recipients.')
    .optional(),
  customDocumentData: z
    .array(
      z.object({
        identifier: z
          .union([z.string(), z.number()])
          .describe(
            'Either the filename or the index of the file that was uploaded. This maps to which envelope item in the template should use this file.',
          ),
        envelopeItemId: z
          .string()
          .describe('The envelope item ID from the template to replace with the uploaded file.'),
      }),
    )
    .describe(
      'Map uploaded files to specific envelope items in the template. If not provided, files will be ignored.',
    )
    .optional(),
  folderId: z
    .string()
    .describe(
      'The ID of the folder to create the document in. If not provided, the document will be created in the root folder.',
    )
    .optional(),
  prefillFields: z
    .array(ZFieldMetaPrefillFieldsSchema)
    .describe(
      'The fields to prefill on the document before sending it out. Useful when you want to create a document from an existing template and pre-fill the fields with specific values.',
    )
    .optional(),
  override: z
    .object({
      title: z.string().min(1).max(255).optional(),
      subject: ZDocumentMetaSubjectSchema.optional(),
      message: ZDocumentMetaMessageSchema.optional(),
      timezone: ZDocumentMetaTimezoneSchema.optional(),
      dateFormat: ZDocumentMetaDateFormatSchema.optional(),
      redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
      distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
      language: ZDocumentMetaLanguageSchema.optional(),
      typedSignatureEnabled: ZDocumentMetaTypedSignatureEnabledSchema.optional(),
      uploadSignatureEnabled: ZDocumentMetaUploadSignatureEnabledSchema.optional(),
      drawSignatureEnabled: ZDocumentMetaDrawSignatureEnabledSchema.optional(),
      allowDictateNextSigner: z.boolean().optional(),
    })
    .describe('Override values from the template for the created document.')
    .optional(),
  attachments: z
    .array(
      z.object({
        label: z.string().min(1, 'Label is required'),
        data: z.string().url('Must be a valid URL'),
        type: ZEnvelopeAttachmentTypeSchema.optional().default('link'),
      }),
    )
    .optional(),
});

export const ZUseEnvelopeRequestSchema = zodFormData({
  payload: zfd.json(ZUseEnvelopePayloadSchema),
  files: zfd.repeatableOfType(zfd.file()).optional(),
});

export const ZUseEnvelopeResponseSchema = z.object({
  id: z.string().describe('The ID of the created envelope.'),
  recipients: ZRecipientWithSigningUrlSchema.array(),
});

export type TUseEnvelopePayload = z.infer<typeof ZUseEnvelopePayloadSchema>;
export type TUseEnvelopeRequest = z.infer<typeof ZUseEnvelopeRequestSchema>;
export type TUseEnvelopeResponse = z.infer<typeof ZUseEnvelopeResponseSchema>;
