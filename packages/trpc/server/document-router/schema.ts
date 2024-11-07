import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZBaseTableSearchParamsSchema } from '@documenso/lib/types/search-params';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import {
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
  FieldType,
  RecipientRole,
} from '@documenso/prisma/client';

export const ZFindDocumentsQuerySchema = ZBaseTableSearchParamsSchema.extend({
  teamId: z.number().min(1).optional(),
  templateId: z.number().min(1).optional(),
  search: z
    .string()
    .optional()
    .catch(() => undefined),
  source: z.nativeEnum(DocumentSource).optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
  orderBy: z
    .object({
      column: z.enum(['createdAt']),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
}).omit({ query: true });

export const ZFindDocumentAuditLogsQuerySchema = ZBaseTableSearchParamsSchema.extend({
  documentId: z.number().min(1),
  cursor: z.string().optional(),
  filterForRecentActivity: z.boolean().optional(),
  orderBy: z
    .object({
      column: z.enum(['createdAt', 'type']),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
});

export const ZGetDocumentByIdQuerySchema = z.object({
  id: z.number().min(1),
  teamId: z.number().min(1).optional(),
});

export type TGetDocumentByIdQuerySchema = z.infer<typeof ZGetDocumentByIdQuerySchema>;

export const ZGetDocumentByTokenQuerySchema = z.object({
  token: z.string().min(1),
});

export type TGetDocumentByTokenQuerySchema = z.infer<typeof ZGetDocumentByTokenQuerySchema>;

export const ZGetDocumentWithDetailsByIdQuerySchema = z.object({
  id: z.number().min(1),
  teamId: z.number().min(1).optional(),
});

export type TGetDocumentWithDetailsByIdQuerySchema = z.infer<
  typeof ZGetDocumentWithDetailsByIdQuerySchema
>;

export const ZCreateDocumentMutationSchema = z.object({
  title: z.string().min(1),
  documentDataId: z.string().min(1),
  teamId: z.number().optional(),
});

export type TCreateDocumentMutationSchema = z.infer<typeof ZCreateDocumentMutationSchema>;

export const ZSetSettingsForDocumentMutationSchema = z.object({
  documentId: z.number(),
  teamId: z.number().min(1).optional(),
  data: z.object({
    title: z.string().min(1).optional(),
    externalId: z.string().nullish(),
    visibility: z.string().optional(),
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

export const ZSetTitleForDocumentMutationSchema = z.object({
  documentId: z.number(),
  teamId: z.number().min(1).optional(),
  title: z.string().min(1),
});

export type TSetTitleForDocumentMutationSchema = z.infer<typeof ZSetTitleForDocumentMutationSchema>;

export const ZSetRecipientsForDocumentMutationSchema = z.object({
  documentId: z.number(),
  teamId: z.number().min(1).optional(),
  recipients: z.array(
    z.object({
      id: z.number().nullish(),
      email: z.string().min(1).email(),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
    }),
  ),
});

export type TSetRecipientsForDocumentMutationSchema = z.infer<
  typeof ZSetRecipientsForDocumentMutationSchema
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
  teamId: z.number().optional(),
  meta: z.object({
    subject: z.string(),
    message: z.string(),
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    redirectUrl: z
      .string()
      .optional()
      .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
        message:
          'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
      }),
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
  teamId: z.number().optional(),
  typedSignatureEnabled: z.boolean(),
});

export type TUpdateTypedSignatureSettingsMutationSchema = z.infer<
  typeof ZUpdateTypedSignatureSettingsMutationSchema
>;

export const ZResendDocumentMutationSchema = z.object({
  documentId: z.number(),
  recipients: z.array(z.number()).min(1),
  teamId: z.number().min(1).optional(),
});

export type TSendDocumentMutationSchema = z.infer<typeof ZSendDocumentMutationSchema>;

export const ZDeleteDraftDocumentMutationSchema = z.object({
  id: z.number().min(1),
  teamId: z.number().min(1).optional(),
});

export type TDeleteDraftDocumentMutationSchema = z.infer<typeof ZDeleteDraftDocumentMutationSchema>;

export const ZSearchDocumentsMutationSchema = z.object({
  query: z.string(),
});

export const ZDownloadAuditLogsMutationSchema = z.object({
  documentId: z.number(),
  teamId: z.number().optional(),
});

export const ZDownloadCertificateMutationSchema = z.object({
  documentId: z.number(),
  teamId: z.number().optional(),
});

export const ZMoveDocumentsToTeamSchema = z.object({
  documentId: z.number(),
  teamId: z.number(),
});
