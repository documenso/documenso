////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Be aware that any changes to this file may need migrations since we're store JSON in Prisma.
//
////////////////////////////////////////////////////////////////////////////////////////////////////
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
  'DOCUMENT_FIELD_SIGNED',
  'DOCUMENT_FIELD_UNSIGNED',
  'DOCUMENT_META_UPDATED',
  'DOCUMENT_OPENED',
  'DOCUMENT_TITLE_UPDATED',
  'DOCUMENT_RECIPIENT_FLOW_COMPLETE',
]);

export const ZDocumentMetaDiffTypeSchema = z.enum([
  'DATE_FORMAT',
  'MESSAGE',
  'PASSWORD',
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
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT),
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
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED),
  }),
});

/**
 * Event: Document created.
 */
export const ZDocumentAuditLogEventDocumentCreatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED),
  data: z.object({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED),
    title: z.string(),
  }),
});

/**
 * Event: Document field signed.
 */
export const ZDocumentAuditLogEventDocumentFieldSignedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_SIGNED),
  data: ZBaseRecipientDataSchema.extend({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_SIGNED),
    fieldId: z.number(),

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
        signatureId: z.string(),
      }),
    ]),

    // Todo: Replace with union once we have more field security types.
    fieldSecurity: z.object({
      type: z.literal('NONE'),
    }),
  }),
});

/**
 * Event: Document field unsigned.
 */
export const ZDocumentAuditLogEventDocumentFieldUnsignedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNSIGNED),
  data: z.object({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNSIGNED),
    field: z.nativeEnum(FieldType),
    fieldId: z.number(),
  }),
});

/**
 * Event: Document meta updated.
 */
export const ZDocumentAuditLogEventDocumentMetaUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED),
  data: z.object({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED),
    changes: z.array(ZDocumentAuditLogDocumentMetaSchema),
  }),
});

/**
 * Event: Document opened.
 */
export const ZDocumentAuditLogEventDocumentOpenedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED),
  data: ZBaseRecipientDataSchema.extend({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED),
  }),
});

/**
 * Event: Document recipient flow complete (the recipient has fully actioned and completed their required steps for the document).
 */
export const ZDocumentAuditLogEventDocumentRecipientFlowCompleteSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_FLOW_COMPLETE),
  data: ZBaseRecipientDataSchema.extend({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_FLOW_COMPLETE),
  }),
});

/**
 * Event: Document title updated.
 */
export const ZDocumentAuditLogEventDocumentTitleUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED),
  data: z.object({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED),
    from: z.string(),
    to: z.string(),
  }),
});

/**
 * Event: Field added.
 */
export const ZDocumentAuditLogEventFieldAddedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED),
  data: ZBaseFieldEventDataSchema.extend({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED),
  }),
});

/**
 * Event: Field deleted.
 */
export const ZDocumentAuditLogEventFieldRemovedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED),
  data: ZBaseFieldEventDataSchema.extend({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED),
  }),
});

/**
 * Event: Field updated.
 */
export const ZDocumentAuditLogEventFieldUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED),
  data: ZBaseFieldEventDataSchema.extend({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED),
    changes: z.array(ZDocumentAuditLogFieldDiffSchema),
  }),
});

/**
 * Event: Recipient added.
 */
export const ZDocumentAuditLogEventRecipientAddedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED),
  data: ZBaseRecipientDataSchema.extend({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED),
  }),
});

/**
 * Event: Recipient updated.
 */
export const ZDocumentAuditLogEventRecipientUpdatedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED),
  data: ZBaseRecipientDataSchema.extend({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED),
    changes: z.array(ZDocumentAuditLogRecipientDiffSchema),
  }),
});

/**
 * Event: Recipient deleted.
 */
export const ZDocumentAuditLogEventRecipientRemovedSchema = z.object({
  type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED),
  data: ZBaseRecipientDataSchema.extend({
    type: z.literal(DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED),
  }),
});

export const ZDocumentAuditLogBaseSchema = z.object({
  id: z.number(),
  createdAt: z.date(),
  documentId: z.number(),
});

export const ZDocumentAuditLogSchema = ZDocumentAuditLogBaseSchema.and(
  z.union([
    ZDocumentAuditLogEventEmailSentSchema,
    ZDocumentAuditLogEventDocumentCompletedSchema,
    ZDocumentAuditLogEventDocumentCreatedSchema,
    ZDocumentAuditLogEventDocumentFieldSignedSchema,
    ZDocumentAuditLogEventDocumentFieldUnsignedSchema,
    ZDocumentAuditLogEventDocumentMetaUpdatedSchema,
    ZDocumentAuditLogEventDocumentOpenedSchema,
    ZDocumentAuditLogEventDocumentRecipientFlowCompleteSchema,
    ZDocumentAuditLogEventDocumentTitleUpdatedSchema,
    ZDocumentAuditLogEventFieldAddedSchema,
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
