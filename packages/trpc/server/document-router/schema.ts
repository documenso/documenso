import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import {
  DocumentDistributionMethod,
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
  DocumentVisibility,
  FieldType,
} from '@documenso/prisma/client';

export const ZFindDocumentsQuerySchema = ZFindSearchParamsSchema.extend({
  templateId: z.number().min(1).optional(),
  source: z.nativeEnum(DocumentSource).optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
  orderByColumn: z.enum(['createdAt']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).default('desc'),
});

export const ZFindDocumentAuditLogsQuerySchema = ZFindSearchParamsSchema.extend({
  documentId: z.number().min(1),
  cursor: z.string().optional(),
  filterForRecentActivity: z.boolean().optional(),
  orderByColumn: z.enum(['createdAt', 'type']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).default('desc'),
});

export const ZGetDocumentByIdQuerySchema = z.object({
  documentId: z.number().min(1),
});

export const ZDuplicateDocumentMutationSchema = z.object({
  documentId: z.number().min(1),
});

export type TGetDocumentByIdQuerySchema = z.infer<typeof ZGetDocumentByIdQuerySchema>;

export const ZGetDocumentByTokenQuerySchema = z.object({
  token: z.string().min(1),
});

export type TGetDocumentByTokenQuerySchema = z.infer<typeof ZGetDocumentByTokenQuerySchema>;

export const ZGetDocumentWithDetailsByIdQuerySchema = z.object({
  documentId: z.number().min(1),
});

export type TGetDocumentWithDetailsByIdQuerySchema = z.infer<
  typeof ZGetDocumentWithDetailsByIdQuerySchema
>;

export const ZCreateDocumentMutationSchema = z.object({
  title: z.string().min(1),
  documentDataId: z.string().min(1),
  timezone: z.string().optional(),
});

export type TCreateDocumentMutationSchema = z.infer<typeof ZCreateDocumentMutationSchema>;

export const ZSetSettingsForDocumentMutationSchema = z.object({
  documentId: z.number(),
  data: z.object({
    title: z.string().min(1).optional(),
    externalId: z.string().nullish(),
    visibility: z.nativeEnum(DocumentVisibility).optional(),
    globalAccessAuth: ZDocumentAccessAuthTypesSchema.nullable().optional(),
    globalActionAuth: ZDocumentActionAuthTypesSchema.nullable().optional(),
  }),
  meta: z.object({
    timezone: z.string(),
    dateFormat: z.string(),
    redirectUrl: z
      .string()
      .optional()
      .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
        message:
          'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
      }),
    language: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
  }),
});

export type TSetGeneralSettingsForDocumentMutationSchema = z.infer<
  typeof ZSetSettingsForDocumentMutationSchema
>;

export const ZSetFieldsForDocumentMutationSchema = z.object({
  documentId: z.number(),
  fields: z.array(
    z.object({
      id: z.number().nullish(),
      type: z.nativeEnum(FieldType),
      signerEmail: z.string().min(1),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
    }),
  ),
});

export type TSetFieldsForDocumentMutationSchema = z.infer<
  typeof ZSetFieldsForDocumentMutationSchema
>;

export const ZSendDocumentMutationSchema = z.object({
  documentId: z.number(),
  meta: z.object({
    subject: z.string(),
    message: z.string(),
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    distributionMethod: z.nativeEnum(DocumentDistributionMethod).optional(),
    redirectUrl: z
      .string()
      .optional()
      .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
        message:
          'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
      }),
    emailSettings: ZDocumentEmailSettingsSchema.optional(),
  }),
});

export const ZSetPasswordForDocumentMutationSchema = z.object({
  documentId: z.number(),
  password: z.string(),
});

export type TSetPasswordForDocumentMutationSchema = z.infer<
  typeof ZSetPasswordForDocumentMutationSchema
>;

export const ZSetSigningOrderForDocumentMutationSchema = z.object({
  documentId: z.number(),
  signingOrder: z.nativeEnum(DocumentSigningOrder),
});

export type TSetSigningOrderForDocumentMutationSchema = z.infer<
  typeof ZSetSigningOrderForDocumentMutationSchema
>;

export const ZUpdateTypedSignatureSettingsMutationSchema = z.object({
  documentId: z.number(),
  typedSignatureEnabled: z.boolean(),
});

export type TUpdateTypedSignatureSettingsMutationSchema = z.infer<
  typeof ZUpdateTypedSignatureSettingsMutationSchema
>;

export const ZResendDocumentMutationSchema = z.object({
  documentId: z.number(),
  recipients: z.array(z.number()).min(1),
});

export type TSendDocumentMutationSchema = z.infer<typeof ZSendDocumentMutationSchema>;

export const ZDeleteDocumentMutationSchema = z.object({
  documentId: z.number().min(1),
});

export type TDeleteDocumentMutationSchema = z.infer<typeof ZDeleteDocumentMutationSchema>;

export const ZSearchDocumentsMutationSchema = z.object({
  query: z.string(),
});

export const ZDownloadAuditLogsMutationSchema = z.object({
  documentId: z.number(),
});

export const ZDownloadCertificateMutationSchema = z.object({
  documentId: z.number(),
});

export const ZMoveDocumentToTeamSchema = z.object({
  documentId: z.number(),
  teamId: z.number(),
});
