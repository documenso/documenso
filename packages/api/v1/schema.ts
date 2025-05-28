import { extendZodWithOpenApi } from '@anatine/zod-openapi';
import {
  DocumentDataType,
  DocumentDistributionMethod,
  DocumentSigningOrder,
  FieldType,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
  TeamMemberRole,
  TemplateType,
} from '@prisma/client';
import { z } from 'zod';

import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { ZUrlSchema } from '@documenso/lib/schemas/common';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
  ZRecipientActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { ZFieldMetaPrefillFieldsSchema, ZFieldMetaSchema } from '@documenso/lib/types/field-meta';

extendZodWithOpenApi(z);

export const ZNoBodyMutationSchema = null;

/**
 * Documents
 */
export const ZGetDocumentsQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  perPage: z.coerce.number().min(1).optional().default(1),
});

export type TGetDocumentsQuerySchema = z.infer<typeof ZGetDocumentsQuerySchema>;

export const ZDeleteDocumentMutationSchema = null;

export type TDeleteDocumentMutationSchema = typeof ZDeleteDocumentMutationSchema;

export const ZSuccessfulDocumentResponseSchema = z.object({
  id: z.number(),
  externalId: z.string().nullish(),
  userId: z.number(),
  teamId: z.number().nullish(),
  title: z.string(),
  status: z.string(),
  documentDataId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
});

export const ZSuccessfulGetDocumentResponseSchema = ZSuccessfulDocumentResponseSchema.extend({
  recipients: z.lazy(() => z.array(ZSuccessfulRecipientResponseSchema)),
  fields: z.lazy(() =>
    ZFieldSchema.pick({
      id: true,
      documentId: true,
      recipientId: true,
      type: true,
      page: true,
      positionX: true,
      positionY: true,
      width: true,
      height: true,
      customText: true,
      fieldMeta: true,
    })
      .extend({
        fieldMeta: ZFieldMetaSchema.nullish(),
      })
      .array(),
  ),
});

export type TSuccessfulGetDocumentResponseSchema = z.infer<
  typeof ZSuccessfulGetDocumentResponseSchema
>;

export type TSuccessfulDocumentResponseSchema = z.infer<typeof ZSuccessfulDocumentResponseSchema>;

export const ZSendDocumentForSigningMutationSchema = z
  .object({
    sendEmail: z.boolean().optional().default(true).openapi({
      description:
        'Whether to send an email to the recipients asking them to action the document. If you disable this, you will need to manually distribute the document to the recipients using the generated signing links.',
    }),
    sendCompletionEmails: z.boolean().optional().openapi({
      description:
        'Whether to send completion emails when the document is fully signed. This will override the document email settings.',
    }),
  })
  .or(z.any().transform(() => ({ sendEmail: true, sendCompletionEmails: undefined })));

export type TSendDocumentForSigningMutationSchema = typeof ZSendDocumentForSigningMutationSchema;

export const ZResendDocumentForSigningMutationSchema = z.object({
  recipients: z.array(z.number()),
});

export type TResendDocumentForSigningMutationSchema = z.infer<
  typeof ZResendDocumentForSigningMutationSchema
>;

export const ZSuccessfulResendDocumentResponseSchema = z.object({
  message: z.string(),
});

export type TResendDocumentResponseSchema = z.infer<typeof ZSuccessfulResendDocumentResponseSchema>;

export const ZUploadDocumentSuccessfulSchema = z.object({
  url: z.string(),
  key: z.string(),
});

export const ZDownloadDocumentQuerySchema = z.object({
  downloadOriginalDocument: z
    .preprocess((val) => String(val) === 'true' || String(val) === '1', z.boolean())
    .optional()
    .default(false),
});

export type TDownloadDocumentQuerySchema = z.infer<typeof ZDownloadDocumentQuerySchema>;

export const ZDownloadDocumentSuccessfulSchema = z.object({
  downloadUrl: z.string(),
});

export type TUploadDocumentSuccessfulSchema = z.infer<typeof ZUploadDocumentSuccessfulSchema>;

export const ZCreateDocumentMutationSchema = z.object({
  title: z.string().min(1),
  externalId: z.string().nullish(),
  recipients: z.array(
    z.object({
      name: z.string().min(1),
      email: z.string().email().min(1),
      role: z.nativeEnum(RecipientRole).optional().default(RecipientRole.SIGNER),
      signingOrder: z.number().nullish(),
    }),
  ),
  meta: z
    .object({
      subject: z.string(),
      message: z.string(),
      timezone: z.string().default(DEFAULT_DOCUMENT_TIME_ZONE).openapi({
        description:
          'The timezone of the date. Must be one of the options listed in the list below.',
        enum: TIME_ZONES,
      }),
      dateFormat: z
        .string()
        .default(DEFAULT_DOCUMENT_DATE_FORMAT)
        .openapi({
          description:
            'The format of the date. Must be one of the options listed in the list below.',
          enum: DATE_FORMATS.map((format) => format.value),
        }),
      redirectUrl: z.string(),
      signingOrder: z.nativeEnum(DocumentSigningOrder).optional(),
      allowDictateNextSigner: z.boolean().optional(),
      language: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
      typedSignatureEnabled: z.boolean().optional().default(true),
      uploadSignatureEnabled: z.boolean().optional().default(true),
      drawSignatureEnabled: z.boolean().optional().default(true),
      distributionMethod: z.nativeEnum(DocumentDistributionMethod).optional(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
    })
    .partial()
    .optional()
    .default({}),
  authOptions: z
    .object({
      globalAccessAuth: ZDocumentAccessAuthTypesSchema.optional(),
      globalActionAuth: ZDocumentActionAuthTypesSchema.optional(),
    })
    .optional()
    .openapi({
      description: 'The globalActionAuth property is only available for Enterprise accounts.',
    }),
  formValues: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
});

export type TCreateDocumentMutationSchema = z.infer<typeof ZCreateDocumentMutationSchema>;

export const ZCreateDocumentMutationResponseSchema = z.object({
  uploadUrl: z.string().min(1),
  documentId: z.number(),
  externalId: z.string().nullish(),
  recipients: z.array(
    z.object({
      recipientId: z.number(),
      name: z.string(),
      email: z.string().email().min(1),
      token: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().nullish(),

      signingUrl: z.string(),
    }),
  ),
});

export type TCreateDocumentMutationResponseSchema = z.infer<
  typeof ZCreateDocumentMutationResponseSchema
>;

export const ZCreateDocumentFromTemplateMutationSchema = z.object({
  title: z.string().min(1),
  externalId: z.string().nullish(),
  recipients: z.array(
    z.object({
      name: z.string().min(1),
      email: z.string().email().min(1),
      role: z.nativeEnum(RecipientRole).optional().default(RecipientRole.SIGNER),
      signingOrder: z.number().nullish(),
    }),
  ),
  meta: z
    .object({
      subject: z.string(),
      message: z.string(),
      timezone: z.string(),
      dateFormat: z.string(),
      redirectUrl: z.string(),
      signingOrder: z.nativeEnum(DocumentSigningOrder).optional(),
      allowDictateNextSigner: z.boolean().optional(),
      language: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
    })
    .partial()
    .optional(),
  authOptions: z
    .object({
      globalAccessAuth: ZDocumentAccessAuthTypesSchema.optional(),
      globalActionAuth: ZDocumentActionAuthTypesSchema.optional(),
    })
    .optional(),
  formValues: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
});

export type TCreateDocumentFromTemplateMutationSchema = z.infer<
  typeof ZCreateDocumentFromTemplateMutationSchema
>;

export const ZCreateDocumentFromTemplateMutationResponseSchema = z.object({
  documentId: z.number(),
  externalId: z.string().nullish(),
  recipients: z.array(
    z.object({
      recipientId: z.number(),
      name: z.string(),
      email: z.string().email().min(1),
      token: z.string(),
      role: z.nativeEnum(RecipientRole).optional().default(RecipientRole.SIGNER),
      signingOrder: z.number().nullish(),

      signingUrl: z.string(),
    }),
  ),
});

export type TCreateDocumentFromTemplateMutationResponseSchema = z.infer<
  typeof ZCreateDocumentFromTemplateMutationResponseSchema
>;

export const ZGenerateDocumentFromTemplateMutationSchema = z.object({
  title: z.string().optional(),
  externalId: z.string().optional(),
  recipients: z
    .array(
      z.object({
        id: z.number(),
        email: z.string().email(),
        name: z.string().optional(),
        signingOrder: z.number().optional(),
      }),
    )
    .refine(
      (schema) => {
        const emails = schema.map((signer) => signer.email.toLowerCase());
        const ids = schema.map((signer) => signer.id);

        return new Set(emails).size === emails.length && new Set(ids).size === ids.length;
      },
      { message: 'Recipient IDs and emails must be unique' },
    ),
  meta: z
    .object({
      subject: z.string(),
      message: z.string(),
      timezone: z.string(),
      dateFormat: z.string(),
      redirectUrl: ZUrlSchema,
      signingOrder: z.nativeEnum(DocumentSigningOrder),
      allowDictateNextSigner: z.boolean(),
      language: z.enum(SUPPORTED_LANGUAGE_CODES),
      distributionMethod: z.nativeEnum(DocumentDistributionMethod),
      typedSignatureEnabled: z.boolean(),
      uploadSignatureEnabled: z.boolean(),
      drawSignatureEnabled: z.boolean(),
      emailSettings: ZDocumentEmailSettingsSchema,
    })
    .partial()
    .optional(),
  authOptions: z
    .object({
      globalAccessAuth: ZDocumentAccessAuthTypesSchema.optional(),
      globalActionAuth: ZDocumentActionAuthTypesSchema.optional(),
    })
    .optional(),
  formValues: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
  prefillFields: z.array(ZFieldMetaPrefillFieldsSchema).optional(),
});

export type TGenerateDocumentFromTemplateMutationSchema = z.infer<
  typeof ZGenerateDocumentFromTemplateMutationSchema
>;

export const ZGenerateDocumentFromTemplateMutationResponseSchema = z.object({
  documentId: z.number(),
  externalId: z.string().nullish(),
  recipients: z.array(
    z.object({
      recipientId: z.number(),
      name: z.string(),
      email: z.string().email().min(1),
      token: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().nullish(),

      signingUrl: z.string(),
    }),
  ),
});

export type TGenerateDocumentFromTemplateMutationResponseSchema = z.infer<
  typeof ZGenerateDocumentFromTemplateMutationResponseSchema
>;

export const ZCreateRecipientMutationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().min(1),
  role: z.nativeEnum(RecipientRole).optional().default(RecipientRole.SIGNER),
  signingOrder: z.number().nullish(),
  authOptions: z
    .object({
      actionAuth: ZRecipientActionAuthTypesSchema.optional(),
    })
    .optional()
    .openapi({
      description: 'The authOptions property is only available for Enterprise accounts.',
    }),
});

/**
 * Recipients
 */
export type TCreateRecipientMutationSchema = z.infer<typeof ZCreateRecipientMutationSchema>;

export const ZUpdateRecipientMutationSchema = ZCreateRecipientMutationSchema.partial();

export type TUpdateRecipientMutationSchema = z.infer<typeof ZUpdateRecipientMutationSchema>;

export const ZDeleteRecipientMutationSchema = null;

export type TDeleteRecipientMutationSchema = typeof ZDeleteRecipientMutationSchema;

export const ZSuccessfulRecipientResponseSchema = z.object({
  id: z.number(),
  // !: This handles the fact that we have null documentId's for templates
  // !: while we won't need the default we must add it to satisfy typescript
  documentId: z.number().nullish().default(-1),
  email: z.string().email().min(1),
  name: z.string(),
  role: z.nativeEnum(RecipientRole),
  signingOrder: z.number().nullish(),
  token: z.string(),
  // !: Not used for now
  // expired: z.string(),
  signedAt: z.date().nullable(),
  readStatus: z.nativeEnum(ReadStatus),
  signingStatus: z.nativeEnum(SigningStatus),
  sendStatus: z.nativeEnum(SendStatus),

  signingUrl: z.string(),
});

export type TSuccessfulRecipientResponseSchema = z.infer<typeof ZSuccessfulRecipientResponseSchema>;

/**
 * Fields
 */
const ZCreateFieldSchema = z.object({
  recipientId: z.number(),
  type: z.nativeEnum(FieldType),
  pageNumber: z.number(),
  pageX: z.number(),
  pageY: z.number(),
  pageWidth: z.number(),
  pageHeight: z.number(),
  fieldMeta: ZFieldMetaSchema.openapi({}),
});

export const ZCreateFieldMutationSchema = z.union([
  ZCreateFieldSchema,
  z.array(ZCreateFieldSchema).min(1),
]);

export type TCreateFieldMutationSchema = z.infer<typeof ZCreateFieldMutationSchema>;

export const ZUpdateFieldMutationSchema = ZCreateFieldSchema.partial();

export type TUpdateFieldMutationSchema = z.infer<typeof ZUpdateFieldMutationSchema>;

export const ZDeleteFieldMutationSchema = null;

export type TDeleteFieldMutationSchema = typeof ZDeleteFieldMutationSchema;

const ZSuccessfulFieldSchema = z.object({
  id: z.number(),
  documentId: z.number(),
  recipientId: z.number(),
  type: z.nativeEnum(FieldType),
  pageNumber: z.number(),
  pageX: z.number(),
  pageY: z.number(),
  pageWidth: z.number(),
  pageHeight: z.number(),
  customText: z.string(),
  fieldMeta: ZFieldMetaSchema,
  inserted: z.boolean(),
});

export const ZSuccessfulFieldCreationResponseSchema = z.object({
  fields: z.union([ZSuccessfulFieldSchema, z.array(ZSuccessfulFieldSchema)]),
  documentId: z.number(),
});

export const ZSuccessfulFieldResponseSchema = z.object({
  id: z.number(),
  documentId: z.number(),
  recipientId: z.number(),
  type: z.nativeEnum(FieldType),
  pageNumber: z.number(),
  pageX: z.number(),
  pageY: z.number(),
  pageWidth: z.number(),
  pageHeight: z.number(),
  customText: z.string(),
  fieldMeta: ZFieldMetaSchema,
  inserted: z.boolean(),
});

export type TSuccessfulFieldResponseSchema = z.infer<typeof ZSuccessfulFieldResponseSchema>;

export const ZSuccessfulResponseSchema = z.object({
  documents: ZSuccessfulDocumentResponseSchema.array(),
  totalPages: z.number(),
});

export type TSuccessfulResponseSchema = z.infer<typeof ZSuccessfulResponseSchema>;

export const ZSuccessfulSigningResponseSchema = z
  .object({
    message: z.string(),
  })
  .and(ZSuccessfulGetDocumentResponseSchema.omit({ fields: true }));

export type TSuccessfulSigningResponseSchema = z.infer<typeof ZSuccessfulSigningResponseSchema>;

/**
 * General
 */
export const ZAuthorizationHeadersSchema = z.object({
  authorization: z.string(),
});

export type TAuthorizationHeadersSchema = z.infer<typeof ZAuthorizationHeadersSchema>;

export const ZUnsuccessfulResponseSchema = z.object({
  message: z.string(),
});

export type TUnsuccessfulResponseSchema = z.infer<typeof ZUnsuccessfulResponseSchema>;

export const ZTemplateMetaSchema = z.object({
  id: z.string(),
  subject: z.string().nullish(),
  message: z.string().nullish(),
  timezone: z.string().nullish(),
  dateFormat: z.string().nullish(),
  templateId: z.number(),
  redirectUrl: z.string().nullish(),
  signingOrder: z.nativeEnum(DocumentSigningOrder).nullish().default(DocumentSigningOrder.PARALLEL),
});

export const ZTemplateSchema = z.object({
  id: z.number(),
  externalId: z.string().nullish(),
  type: z.nativeEnum(TemplateType),
  title: z.string(),
  userId: z.number(),
  teamId: z.number().nullish(),
  templateDocumentDataId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ZRecipientSchema = z.object({
  id: z.number(),
  documentId: z.number().nullish(),
  templateId: z.number().nullish(),
  email: z.string().email().min(1),
  name: z.string(),
  token: z.string(),
  signingOrder: z.number().nullish(),
  documentDeletedAt: z.date().nullish(),
  expired: z.date().nullish(),
  signedAt: z.date().nullish(),
  authOptions: z.unknown(),
  role: z.nativeEnum(RecipientRole),
  readStatus: z.nativeEnum(ReadStatus),
  signingStatus: z.nativeEnum(SigningStatus),
  sendStatus: z.nativeEnum(SendStatus),
});

export const ZFieldSchema = z.object({
  id: z.number(),
  secondaryId: z.string(),
  documentId: z.number().nullish(),
  templateId: z.number().nullish(),
  recipientId: z.number(),
  type: z.nativeEnum(FieldType),
  page: z.number(),
  positionX: z.unknown(),
  positionY: z.unknown(),
  width: z.unknown(),
  height: z.unknown(),
  customText: z.string(),
  inserted: z.boolean(),
  fieldMeta: ZFieldMetaSchema.nullish().openapi({}),
});

export const ZTemplateWithDataSchema = ZTemplateSchema.extend({
  templateMeta: ZTemplateMetaSchema.nullish(),
  directLink: z
    .object({
      token: z.string(),
      enabled: z.boolean(),
    })
    .nullable(),
  templateDocumentData: z.object({
    id: z.string(),
    type: z.nativeEnum(DocumentDataType),
    data: z.string(),
  }),
  Field: ZFieldSchema.pick({
    id: true,
    documentId: true,
    templateId: true,
    recipientId: true,
    type: true,
    page: true,
    positionX: true,
    positionY: true,
    width: true,
    height: true,
    customText: true,
    fieldMeta: true,
  }).array(),
  Recipient: ZRecipientSchema.pick({
    id: true,
    email: true,
    name: true,
    signingOrder: true,
    authOptions: true,
    role: true,
  }).array(),
});

export const ZSuccessfulGetTemplateResponseSchema = ZTemplateWithDataSchema;

export const ZSuccessfulDeleteTemplateResponseSchema = ZTemplateSchema;

export const ZSuccessfulGetTemplatesResponseSchema = z.object({
  templates: ZTemplateWithDataSchema.omit({
    templateDocumentData: true,
    templateMeta: true,
  }).array(),
  totalPages: z.number(),
});

export const ZGetTemplatesQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  perPage: z.coerce.number().min(1).optional().default(1),
});

export const ZFindTeamMembersResponseSchema = z.object({
  members: z.array(
    z.object({
      id: z.number(),
      email: z.string().email(),
      role: z.nativeEnum(TeamMemberRole),
    }),
  ),
});

export const ZInviteTeamMemberMutationSchema = z.object({
  email: z
    .string()
    .email()
    .transform((email) => email.toLowerCase()),
  role: z.nativeEnum(TeamMemberRole).optional().default(TeamMemberRole.MEMBER),
});

export const ZSuccessfulInviteTeamMemberResponseSchema = z.object({
  message: z.string(),
});

export const ZUpdateTeamMemberMutationSchema = z.object({
  role: z.nativeEnum(TeamMemberRole),
});

export const ZSuccessfulUpdateTeamMemberResponseSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: z.nativeEnum(TeamMemberRole),
});

export const ZSuccessfulRemoveTeamMemberResponseSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: z.nativeEnum(TeamMemberRole),
});
