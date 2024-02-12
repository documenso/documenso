/////////////////////////////////////////////////////////////////////////////////////////////
//
// Be aware that any changes to this file may require migrations since we are storing JSON
// data in Prisma.
//
/////////////////////////////////////////////////////////////////////////////////////////////
import { z } from 'zod';

import { FieldType } from '@documenso/prisma/client';

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

  // Document events.
  'DOCUMENT_COMPLETED',
  'DOCUMENT_CREATED',
  'DOCUMENT_DELETED',
  'DOCUMENT_FIELD_INSERTED',
  'DOCUMENT_FIELD_UNINSERTED',
  'DOCUMENT_META_UPDATED',
  'DOCUMENT_OPENED',
  'DOCUMENT_TITLE_UPDATED',
  'DOCUMENT_RECIPIENT_COMPLETED',
]);

export const ZDocumentMetaDiffTypeSchema = z.enum([
  'DATE_FORMAT',
  'MESSAGE',
  'PASSWORD',
  'REDIRECT_URL',
  'SUBJECT',
  'TIMEZONE',
]);
export const ZFieldDiffTypeSchema = z.enum(['DIMENSION', 'POSITION']);
export const ZRecipientDiffTypeSchema = z.enum(['NAME', 'ROLE', 'EMAIL']);

export const DOCUMENT_AUDIT_LOG_TYPE = ZDocumentAuditLogTypeSchema.Enum;
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

export const ZRecipientDiffNameSchema = z.object({
  type: z.literal(RECIPIENT_DIFF_TYPE.NAME),
  from: z.string(),
  to: z.string(),
});

export const ZRecipientDiffRoleSchema = z.object({
  type: z.literal(RECIPIENT_DIFF_TYPE.ROLE),
  from: z.string(),
  to: z.string(),
});

export const ZRecipientDiffEmailSchema = z.object({
  type: z.literal(RECIPIENT_DIFF_TYPE.EMAIL),
  from: z.string(),
  to: z.string(),
});

export const ZDocumentAuditLogRecipientDiffSchema = z.union([
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
 * Event: Email sent.
 */
export const ZDocumentAuditLogEventEmailSentSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT),
  data: ZBaseRecipientDataSchema.extend({
    emailType: z.enum([
      'SIGNING_REQUEST',
      'VIEW_REQUEST',
      'APPROVE_REQUEST',
      'CC',
      'DOCUMENT_COMPLETED',
    ]),
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
    ]),

    // Todo: Replace with union once we have more field security types.
    fieldSecurity: z.object({
      type: z.literal('NONE'),
    }),
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
  data: ZBaseRecipientDataSchema,
});

/**
 * Event: Document recipient completed the document (the recipient has fully actioned and completed their required steps for the document).
 */
export const ZDocumentAuditLogEventDocumentRecipientCompleteSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED),
  data: ZBaseRecipientDataSchema,
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
    changes: z.array(ZDocumentAuditLogFieldDiffSchema),
  }),
});

/**
 * Event: Recipient added.
 */
export const ZDocumentAuditLogEventRecipientAddedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED),
  data: ZBaseRecipientDataSchema,
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

export const ZDocumentAuditLogBaseSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  documentId: z.number(),
});

export const ZDocumentAuditLogSchema = ZDocumentAuditLogBaseSchema.and(
  z.union([
    ZDocumentAuditLogEventEmailSentSchema,
    ZDocumentAuditLogEventDocumentCompletedSchema,
    ZDocumentAuditLogEventDocumentCreatedSchema,
    ZDocumentAuditLogEventDocumentFieldInsertedSchema,
    ZDocumentAuditLogEventDocumentFieldUninsertedSchema,
    ZDocumentAuditLogEventDocumentMetaUpdatedSchema,
    ZDocumentAuditLogEventDocumentOpenedSchema,
    ZDocumentAuditLogEventDocumentRecipientCompleteSchema,
    ZDocumentAuditLogEventDocumentTitleUpdatedSchema,
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
