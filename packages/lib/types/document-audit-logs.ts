/////////////////////////////////////////////////////////////////////////////////////////////
//
// Be aware that any changes to this file may require migrations since we are storing JSON
// data in Prisma.
//
/////////////////////////////////////////////////////////////////////////////////////////////
import { DocumentSource, FieldType } from '@prisma/client';
import { z } from 'zod';

import { ZRecipientAccessAuthTypesSchema, ZRecipientActionAuthTypesSchema } from './document-auth';

export const ZDocumentAuditLogTypeSchema = z.enum([
  // Document actions.
  'EMAIL_SENT',

  // Document modification events.
  'FIELD_CREATED',
  'FIELD_DELETED',
  'FIELD_UPDATED',
  'RECIPIENT_CREATED',
  'RECIPIENT_DELETED',
  'RECIPIENT_UPDATED',

  'ENVELOPE_ITEM_CREATED',
  'ENVELOPE_ITEM_DELETED',

  // Document events.
  'DOCUMENT_COMPLETED', // When the document is sealed and fully completed.
  'DOCUMENT_CREATED', // When the document is created.
  'DOCUMENT_DELETED', // When the document is soft deleted.
  'DOCUMENT_FIELDS_AUTO_INSERTED', // When a field is auto inserted during send due to default values (radio/dropdown/checkbox).
  'DOCUMENT_FIELD_INSERTED', // When a field is inserted (signed/approved/etc) by a recipient.
  'DOCUMENT_FIELD_UNINSERTED', // When a field is uninserted by a recipient.
  'DOCUMENT_FIELD_PREFILLED', // When a field is prefilled by an assistant.
  'DOCUMENT_VISIBILITY_UPDATED', // When the document visibility scope is updated
  'DOCUMENT_GLOBAL_AUTH_ACCESS_UPDATED', // When the global access authentication is updated.
  'DOCUMENT_GLOBAL_AUTH_ACTION_UPDATED', // When the global action authentication is updated.
  'DOCUMENT_META_UPDATED', // When the document meta data is updated.
  'DOCUMENT_OPENED', // When the document is opened by a recipient.
  'DOCUMENT_VIEWED', // When the document is viewed by a recipient.
  'DOCUMENT_RECIPIENT_REJECTED', // When a recipient rejects the document.
  'DOCUMENT_RECIPIENT_COMPLETED', // When a recipient completes all their required tasks for the document.
  'DOCUMENT_SENT', // When the document transitions from DRAFT to PENDING.
  'DOCUMENT_TITLE_UPDATED', // When the document title is updated.
  'DOCUMENT_EXTERNAL_ID_UPDATED', // When the document external ID is updated.
  'DOCUMENT_MOVED_TO_TEAM', // When the document is moved to a team.

  // ACCESS AUTH 2FA events.
  'DOCUMENT_ACCESS_AUTH_2FA_REQUESTED', // When ACCESS AUTH 2FA is requested.
  'DOCUMENT_ACCESS_AUTH_2FA_VALIDATED', // When ACCESS AUTH 2FA is successfully validated.
  'DOCUMENT_ACCESS_AUTH_2FA_FAILED', // When ACCESS AUTH 2FA validation fails.
]);

export const ZDocumentAuditLogEmailTypeSchema = z.enum([
  'SIGNING_REQUEST',
  'VIEW_REQUEST',
  'APPROVE_REQUEST',
  'ASSISTING_REQUEST',
  'CC',
  'DOCUMENT_COMPLETED',
]);

export const ZDocumentMetaDiffTypeSchema = z.enum([
  'DATE_FORMAT',
  'MESSAGE',
  'PASSWORD',
  'REDIRECT_URL',
  'SUBJECT',
  'TIMEZONE',
  'EMAIL_ID',
  'EMAIL_REPLY_TO',
  'EMAIL_SETTINGS',
]);

export const ZFieldDiffTypeSchema = z.enum(['DIMENSION', 'POSITION']);
export const ZRecipientDiffTypeSchema = z.enum([
  'NAME',
  'ROLE',
  'EMAIL',
  'ACCESS_AUTH',
  'ACTION_AUTH',
]);

export const DOCUMENT_AUDIT_LOG_TYPE = ZDocumentAuditLogTypeSchema.Enum;
export const DOCUMENT_EMAIL_TYPE = ZDocumentAuditLogEmailTypeSchema.Enum;
export const DOCUMENT_META_DIFF_TYPE = ZDocumentMetaDiffTypeSchema.Enum;
export const FIELD_DIFF_TYPE = ZFieldDiffTypeSchema.Enum;
export const RECIPIENT_DIFF_TYPE = ZRecipientDiffTypeSchema.Enum;

export const ZFieldDiffDimensionSchema = z.object({
  type: z.literal(FIELD_DIFF_TYPE.DIMENSION),
  from: z.object({
    width: z.number(),
    height: z.number(),
  }),
  to: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

export const ZFieldDiffPositionSchema = z.object({
  type: z.literal(FIELD_DIFF_TYPE.POSITION),
  from: z.object({
    page: z.number(),
    positionX: z.number(),
    positionY: z.number(),
  }),
  to: z.object({
    page: z.number(),
    positionX: z.number(),
    positionY: z.number(),
  }),
});

export const ZDocumentAuditLogDocumentMetaSchema = z.union([
  z.object({
    type: z.union([
      z.literal(DOCUMENT_META_DIFF_TYPE.DATE_FORMAT),
      z.literal(DOCUMENT_META_DIFF_TYPE.MESSAGE),
      z.literal(DOCUMENT_META_DIFF_TYPE.REDIRECT_URL),
      z.literal(DOCUMENT_META_DIFF_TYPE.SUBJECT),
      z.literal(DOCUMENT_META_DIFF_TYPE.TIMEZONE),
      z.literal(DOCUMENT_META_DIFF_TYPE.EMAIL_ID),
      z.literal(DOCUMENT_META_DIFF_TYPE.EMAIL_REPLY_TO),
      z.literal(DOCUMENT_META_DIFF_TYPE.EMAIL_SETTINGS),
    ]),
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
  z.object({
    type: z.literal(DOCUMENT_META_DIFF_TYPE.PASSWORD),
  }),
]);

export const ZDocumentAuditLogFieldDiffSchema = z.union([
  ZFieldDiffDimensionSchema,
  ZFieldDiffPositionSchema,
]);

export const ZGenericFromToSchema = z.object({
  from: z.union([z.string(), z.array(z.string())]).nullable(),
  to: z.union([z.string(), z.array(z.string())]).nullable(),
});

export const ZRecipientDiffActionAuthSchema = ZGenericFromToSchema.extend({
  type: z.literal(RECIPIENT_DIFF_TYPE.ACTION_AUTH),
});

export const ZRecipientDiffAccessAuthSchema = ZGenericFromToSchema.extend({
  type: z.literal(RECIPIENT_DIFF_TYPE.ACCESS_AUTH),
});

export const ZRecipientDiffNameSchema = ZGenericFromToSchema.extend({
  type: z.literal(RECIPIENT_DIFF_TYPE.NAME),
});

export const ZRecipientDiffRoleSchema = ZGenericFromToSchema.extend({
  type: z.literal(RECIPIENT_DIFF_TYPE.ROLE),
});

export const ZRecipientDiffEmailSchema = ZGenericFromToSchema.extend({
  type: z.literal(RECIPIENT_DIFF_TYPE.EMAIL),
});

export const ZDocumentAuditLogRecipientDiffSchema = z.discriminatedUnion('type', [
  ZRecipientDiffActionAuthSchema,
  ZRecipientDiffAccessAuthSchema,
  ZRecipientDiffNameSchema,
  ZRecipientDiffRoleSchema,
  ZRecipientDiffEmailSchema,
]);

const ZBaseFieldEventDataSchema = z.object({
  fieldId: z.string(), // Note: This is the secondary field ID, which will get migrated in the future.
  fieldRecipientEmail: z.string(),
  fieldRecipientId: z.number(),
  fieldType: z.string(), // We specifically don't want to use enums to allow for more flexibility.
});

const ZBaseRecipientDataSchema = z.object({
  recipientEmail: z.string(),
  recipientName: z.string(),
  recipientId: z.number(),
  recipientRole: z.string(),
});

/**
 * Event: Envelope item created.
 */
export const ZDocumentAuditLogEventEnvelopeItemCreatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_CREATED),
  data: z.object({
    envelopeItemId: z.string(),
    envelopeItemTitle: z.string(),
  }),
});

/**
 * Event: Envelope item deleted.
 */
export const ZDocumentAuditLogEventEnvelopeItemDeletedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_DELETED),
  data: z.object({
    envelopeItemId: z.string(),
    envelopeItemTitle: z.string(),
  }),
});

/**
 * Event: Email sent.
 */
export const ZDocumentAuditLogEventEmailSentSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT),
  data: ZBaseRecipientDataSchema.extend({
    emailType: ZDocumentAuditLogEmailTypeSchema,
    isResending: z.boolean(),
  }),
});

/**
 * Event: Document completed.
 */
export const ZDocumentAuditLogEventDocumentCompletedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED),
  data: z.object({
    transactionId: z.string(),
  }),
});

/**
 * Event: Document created.
 */
export const ZDocumentAuditLogEventDocumentCreatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED),
  data: z.object({
    title: z.string(),
    source: z
      .union([
        z.object({
          type: z.literal(DocumentSource.DOCUMENT),
        }),
        z.object({
          type: z.literal(DocumentSource.TEMPLATE),
          templateId: z.number(),
        }),
        z.object({
          type: z.literal(DocumentSource.TEMPLATE_DIRECT_LINK),
          templateId: z.number(),
          directRecipientEmail: z.string().email(),
        }),
      ])
      .optional(),
  }),
});

/**
 * Event: Document deleted.
 */
export const ZDocumentAuditLogEventDocumentDeletedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED),
  data: z.object({
    type: z.enum(['SOFT', 'HARD']),
  }),
});

/**
 * Event: Document field inserted.
 */
export const ZDocumentAuditLogEventDocumentFieldInsertedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED),
  data: ZBaseRecipientDataSchema.extend({
    fieldId: z.string(),

    // Organised into union to allow us to extend each field if required.
    field: z.union([
      z.object({
        type: z.literal(FieldType.INITIALS),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.EMAIL),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.DATE),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.NAME),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.TEXT),
        data: z.string(),
      }),
      z.object({
        type: z.union([z.literal(FieldType.SIGNATURE), z.literal(FieldType.FREE_SIGNATURE)]),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.RADIO),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.CHECKBOX),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.DROPDOWN),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.NUMBER),
        data: z.string(),
      }),
    ]),
    fieldSecurity: z.preprocess(
      (input) => {
        const legacyNoneSecurityType = JSON.stringify({
          type: 'NONE',
        });

        // Replace legacy 'NONE' field security type with undefined.
        if (
          typeof input === 'object' &&
          input !== null &&
          JSON.stringify(input) === legacyNoneSecurityType
        ) {
          return undefined;
        }

        return input;
      },
      z
        .object({
          type: ZRecipientActionAuthTypesSchema.optional(),
        })
        .optional(),
    ),
  }),
});

/**
 * Event: Document field auto inserted.
 */
export const ZDocumentAuditLogEventDocumentFieldsAutoInsertedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELDS_AUTO_INSERTED),
  data: z.object({
    fields: z.array(
      z.object({
        fieldId: z.number(),
        fieldType: z.nativeEnum(FieldType),
        recipientId: z.number(),
      }),
    ),
  }),
});

/**
 * Event: Document field uninserted.
 */
export const ZDocumentAuditLogEventDocumentFieldUninsertedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED),
  data: z.object({
    field: z.nativeEnum(FieldType),
    fieldId: z.string(),
  }),
});

/**
 * Event: Document field prefilled by assistant.
 */
export const ZDocumentAuditLogEventDocumentFieldPrefilledSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_PREFILLED),
  data: ZBaseRecipientDataSchema.extend({
    fieldId: z.string(),

    // Organised into union to allow us to extend each field if required.
    field: z.union([
      z.object({
        type: z.literal(FieldType.INITIALS),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.EMAIL),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.DATE),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.NAME),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.TEXT),
        data: z.string(),
      }),
      z.object({
        type: z.union([z.literal(FieldType.SIGNATURE), z.literal(FieldType.FREE_SIGNATURE)]),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.RADIO),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.CHECKBOX),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.DROPDOWN),
        data: z.string(),
      }),
      z.object({
        type: z.literal(FieldType.NUMBER),
        data: z.string(),
      }),
    ]),
    fieldSecurity: z.preprocess(
      (input) => {
        const legacyNoneSecurityType = JSON.stringify({
          type: 'NONE',
        });

        // Replace legacy 'NONE' field security type with undefined.
        if (
          typeof input === 'object' &&
          input !== null &&
          JSON.stringify(input) === legacyNoneSecurityType
        ) {
          return undefined;
        }

        return input;
      },
      z
        .object({
          type: ZRecipientActionAuthTypesSchema.optional(),
        })
        .optional(),
    ),
  }),
});

export const ZDocumentAuditLogEventDocumentVisibilitySchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_VISIBILITY_UPDATED),
  data: ZGenericFromToSchema,
});

/**
 * Event: Document global authentication access updated.
 */
export const ZDocumentAuditLogEventDocumentGlobalAuthAccessUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_GLOBAL_AUTH_ACCESS_UPDATED),
  data: ZGenericFromToSchema,
});

/**
 * Event: Document global authentication action updated.
 */
export const ZDocumentAuditLogEventDocumentGlobalAuthActionUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_GLOBAL_AUTH_ACTION_UPDATED),
  data: ZGenericFromToSchema,
});

/**
 * Event: Document meta updated.
 */
export const ZDocumentAuditLogEventDocumentMetaUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED),
  data: z.object({
    changes: z.array(ZDocumentAuditLogDocumentMetaSchema),
  }),
});

/**
 * Event: Document opened.
 */
export const ZDocumentAuditLogEventDocumentOpenedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED),
  data: ZBaseRecipientDataSchema.extend({
    accessAuth: z.preprocess((unknownValue) => {
      if (!unknownValue) {
        return [];
      }

      return Array.isArray(unknownValue) ? unknownValue : [unknownValue];
    }, z.array(ZRecipientAccessAuthTypesSchema)),
  }),
});

/**
 * Event: Document viewed.
 */
export const ZDocumentAuditLogEventDocumentViewedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_VIEWED),
  data: ZBaseRecipientDataSchema.extend({
    accessAuth: z.preprocess((unknownValue) => {
      if (!unknownValue) {
        return [];
      }

      return Array.isArray(unknownValue) ? unknownValue : [unknownValue];
    }, z.array(ZRecipientAccessAuthTypesSchema)),
  }),
});

/**
 * Event: Document recipient completed the document (the recipient has fully actioned and completed their required steps for the document).
 */
export const ZDocumentAuditLogEventDocumentRecipientCompleteSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED),
  data: ZBaseRecipientDataSchema.extend({
    actionAuth: z.preprocess((unknownValue) => {
      if (!unknownValue) {
        return [];
      }

      return Array.isArray(unknownValue) ? unknownValue : [unknownValue];
    }, z.array(ZRecipientActionAuthTypesSchema)),
  }),
});

/**
 * Event: Document recipient completed the document (the recipient has fully actioned and completed their required steps for the document).
 */
export const ZDocumentAuditLogEventDocumentRecipientRejectedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED),
  data: ZBaseRecipientDataSchema.extend({
    reason: z.string(),
  }),
});

/**
 * Event: Document recipient requested a 2FA token.
 */
export const ZDocumentAuditLogEventDocumentRecipientRequested2FAEmailSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_REQUESTED),
  data: z.object({
    recipientEmail: z.string(),
    recipientName: z.string(),
    recipientId: z.number(),
  }),
});

/**
 * Event: Document recipient validated a 2FA token.
 */
export const ZDocumentAuditLogEventDocumentRecipientValidated2FAEmailSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_VALIDATED),
  data: z.object({
    recipientEmail: z.string(),
    recipientName: z.string(),
    recipientId: z.number(),
  }),
});

/**
 * Event: Document recipient failed to validate a 2FA token.
 */
export const ZDocumentAuditLogEventDocumentRecipientFailed2FAEmailSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_FAILED),
  data: z.object({
    recipientEmail: z.string(),
    recipientName: z.string(),
    recipientId: z.number(),
  }),
});

/**
 * Event: Document sent.
 */
export const ZDocumentAuditLogEventDocumentSentSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT),
  data: z.object({}),
});

/**
 * Event: Document title updated.
 */
export const ZDocumentAuditLogEventDocumentTitleUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED),
  data: z.object({
    from: z.string(),
    to: z.string(),
  }),
});

/**
 * Event: Document external ID updated.
 */
export const ZDocumentAuditLogEventDocumentExternalIdUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_EXTERNAL_ID_UPDATED),
  data: z.object({
    from: z.string().nullish(),
    to: z.string().nullish(),
  }),
});

/**
 * Event: Field created.
 */
export const ZDocumentAuditLogEventFieldCreatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED),
  data: ZBaseFieldEventDataSchema,
});

/**
 * Event: Field deleted.
 */
export const ZDocumentAuditLogEventFieldRemovedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED),
  data: ZBaseFieldEventDataSchema,
});

/**
 * Event: Field updated.
 */
export const ZDocumentAuditLogEventFieldUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED),
  data: ZBaseFieldEventDataSchema.extend({
    // Provide an empty array as a migration workaround due to a mistake where we were
    // not passing through any changes via API/v1 due to a type error.
    changes: z.preprocess((x) => x || [], z.array(ZDocumentAuditLogFieldDiffSchema)),
  }),
});

/**
 * Event: Recipient added.
 */
export const ZDocumentAuditLogEventRecipientAddedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED),
  data: ZBaseRecipientDataSchema.extend({
    accessAuth: z.preprocess((unknownValue) => {
      if (!unknownValue) {
        return [];
      }

      return Array.isArray(unknownValue) ? unknownValue : [unknownValue];
    }, z.array(ZRecipientAccessAuthTypesSchema)),
    actionAuth: z.preprocess((unknownValue) => {
      if (!unknownValue) {
        return [];
      }

      return Array.isArray(unknownValue) ? unknownValue : [unknownValue];
    }, z.array(ZRecipientActionAuthTypesSchema)),
  }),
});

/**
 * Event: Recipient updated.
 */
export const ZDocumentAuditLogEventRecipientUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED),
  data: ZBaseRecipientDataSchema.extend({
    changes: z.array(ZDocumentAuditLogRecipientDiffSchema),
  }),
});

/**
 * Event: Recipient deleted.
 */
export const ZDocumentAuditLogEventRecipientRemovedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED),
  data: ZBaseRecipientDataSchema,
});

/**
 * Event: Document moved to team.
 */
export const ZDocumentAuditLogEventDocumentMovedToTeamSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_MOVED_TO_TEAM),
  data: z.object({
    movedByUserId: z.number(),
    fromPersonalAccount: z.boolean(),
    toTeamId: z.number(),
  }),
});

export const ZDocumentAuditLogBaseSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  envelopeId: z.string(),
  name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  userId: z.number().optional().nullable(),
  userAgent: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
});

export const ZDocumentAuditLogSchema = ZDocumentAuditLogBaseSchema.and(
  z.union([
    ZDocumentAuditLogEventEnvelopeItemCreatedSchema,
    ZDocumentAuditLogEventEnvelopeItemDeletedSchema,
    ZDocumentAuditLogEventEmailSentSchema,
    ZDocumentAuditLogEventDocumentCompletedSchema,
    ZDocumentAuditLogEventDocumentCreatedSchema,
    ZDocumentAuditLogEventDocumentDeletedSchema,
    ZDocumentAuditLogEventDocumentMovedToTeamSchema,
    ZDocumentAuditLogEventDocumentFieldsAutoInsertedSchema,
    ZDocumentAuditLogEventDocumentFieldInsertedSchema,
    ZDocumentAuditLogEventDocumentFieldUninsertedSchema,
    ZDocumentAuditLogEventDocumentFieldPrefilledSchema,
    ZDocumentAuditLogEventDocumentVisibilitySchema,
    ZDocumentAuditLogEventDocumentGlobalAuthAccessUpdatedSchema,
    ZDocumentAuditLogEventDocumentGlobalAuthActionUpdatedSchema,
    ZDocumentAuditLogEventDocumentMetaUpdatedSchema,
    ZDocumentAuditLogEventDocumentOpenedSchema,
    ZDocumentAuditLogEventDocumentViewedSchema,
    ZDocumentAuditLogEventDocumentRecipientCompleteSchema,
    ZDocumentAuditLogEventDocumentRecipientRejectedSchema,
    ZDocumentAuditLogEventDocumentRecipientRequested2FAEmailSchema,
    ZDocumentAuditLogEventDocumentRecipientValidated2FAEmailSchema,
    ZDocumentAuditLogEventDocumentRecipientFailed2FAEmailSchema,
    ZDocumentAuditLogEventDocumentSentSchema,
    ZDocumentAuditLogEventDocumentTitleUpdatedSchema,
    ZDocumentAuditLogEventDocumentExternalIdUpdatedSchema,
    ZDocumentAuditLogEventFieldCreatedSchema,
    ZDocumentAuditLogEventFieldRemovedSchema,
    ZDocumentAuditLogEventFieldUpdatedSchema,
    ZDocumentAuditLogEventRecipientAddedSchema,
    ZDocumentAuditLogEventRecipientUpdatedSchema,
    ZDocumentAuditLogEventRecipientRemovedSchema,
  ]),
);

export type TDocumentAuditLog = z.infer<typeof ZDocumentAuditLogSchema>;
export type TDocumentAuditLogType = z.infer<typeof ZDocumentAuditLogTypeSchema>;

export type TDocumentAuditLogFieldDiffSchema = z.infer<typeof ZDocumentAuditLogFieldDiffSchema>;

export type TDocumentAuditLogDocumentMetaDiffSchema = z.infer<
  typeof ZDocumentAuditLogDocumentMetaSchema
>;

export type TDocumentAuditLogRecipientDiffSchema = z.infer<
  typeof ZDocumentAuditLogRecipientDiffSchema
>;

export type DocumentAuditLogByType<T = TDocumentAuditLog['type']> = Extract<
  TDocumentAuditLog,
  { type: T }
>;
