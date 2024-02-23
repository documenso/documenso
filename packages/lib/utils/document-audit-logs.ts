import { match } from 'ts-pattern';

import type {
  DocumentAuditLog,
  DocumentMeta,
  Field,
  Recipient,
  RecipientRole,
} from '@documenso/prisma/client';

import { RECIPIENT_ROLES_DESCRIPTION } from '../constants/recipient-roles';
import type {
  TDocumentAuditLog,
  TDocumentAuditLogDocumentMetaDiffSchema,
  TDocumentAuditLogFieldDiffSchema,
  TDocumentAuditLogRecipientDiffSchema,
} from '../types/document-audit-logs';
import {
  DOCUMENT_AUDIT_LOG_TYPE,
  DOCUMENT_META_DIFF_TYPE,
  FIELD_DIFF_TYPE,
  RECIPIENT_DIFF_TYPE,
  ZDocumentAuditLogSchema,
} from '../types/document-audit-logs';
import type { RequestMetadata } from '../universal/extract-request-metadata';

type CreateDocumentAuditLogDataOptions<T = TDocumentAuditLog['type']> = {
  documentId: number;
  type: T;
  data: Extract<TDocumentAuditLog, { type: T }>['data'];
  user: { email?: string; id?: number | null; name?: string | null } | null;
  requestMetadata?: RequestMetadata;
};

type CreateDocumentAuditLogDataResponse = Pick<
  DocumentAuditLog,
  'type' | 'ipAddress' | 'userAgent' | 'email' | 'userId' | 'name' | 'documentId'
> & {
  data: TDocumentAuditLog['data'];
};

export const createDocumentAuditLogData = ({
  documentId,
  type,
  data,
  user,
  requestMetadata,
}: CreateDocumentAuditLogDataOptions): CreateDocumentAuditLogDataResponse => {
  return {
    type,
    data,
    documentId,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    name: user?.name ?? null,
    userAgent: requestMetadata?.userAgent ?? null,
    ipAddress: requestMetadata?.ipAddress ?? null,
  };
};

/**
 * Parse a raw document audit log from Prisma, to a typed audit log.
 *
 * @param auditLog raw audit log from Prisma.
 */
export const parseDocumentAuditLogData = (auditLog: DocumentAuditLog): TDocumentAuditLog => {
  const data = ZDocumentAuditLogSchema.safeParse(auditLog);

  // Handle any required migrations here.
  if (!data.success) {
    console.error(data.error);
    throw new Error('Migration required');
  }

  return data.data;
};

type PartialRecipient = Pick<Recipient, 'email' | 'name' | 'role'>;

export const diffRecipientChanges = (
  oldRecipient: PartialRecipient,
  newRecipient: PartialRecipient,
): TDocumentAuditLogRecipientDiffSchema[] => {
  const diffs: TDocumentAuditLogRecipientDiffSchema[] = [];

  if (oldRecipient.email !== newRecipient.email) {
    diffs.push({
      type: RECIPIENT_DIFF_TYPE.EMAIL,
      from: oldRecipient.email,
      to: newRecipient.email,
    });
  }

  if (oldRecipient.role !== newRecipient.role) {
    diffs.push({
      type: RECIPIENT_DIFF_TYPE.ROLE,
      from: oldRecipient.role,
      to: newRecipient.role,
    });
  }

  if (oldRecipient.name !== newRecipient.name) {
    diffs.push({
      type: RECIPIENT_DIFF_TYPE.NAME,
      from: oldRecipient.name,
      to: newRecipient.name,
    });
  }

  return diffs;
};

export const diffFieldChanges = (
  oldField: Field,
  newField: Field,
): TDocumentAuditLogFieldDiffSchema[] => {
  const diffs: TDocumentAuditLogFieldDiffSchema[] = [];

  if (
    oldField.page !== newField.page ||
    !oldField.positionX.equals(newField.positionX) ||
    !oldField.positionY.equals(newField.positionY)
  ) {
    diffs.push({
      type: FIELD_DIFF_TYPE.POSITION,
      from: {
        page: oldField.page,
        positionX: oldField.positionX.toNumber(),
        positionY: oldField.positionY.toNumber(),
      },
      to: {
        page: newField.page,
        positionX: newField.positionX.toNumber(),
        positionY: newField.positionY.toNumber(),
      },
    });
  }

  if (!oldField.width.equals(newField.width) || !oldField.height.equals(newField.height)) {
    diffs.push({
      type: FIELD_DIFF_TYPE.DIMENSION,
      from: {
        width: oldField.width.toNumber(),
        height: oldField.height.toNumber(),
      },
      to: {
        width: newField.width.toNumber(),
        height: newField.height.toNumber(),
      },
    });
  }

  return diffs;
};

export const diffDocumentMetaChanges = (
  oldData: Partial<DocumentMeta> = {},
  newData: DocumentMeta,
): TDocumentAuditLogDocumentMetaDiffSchema[] => {
  const diffs: TDocumentAuditLogDocumentMetaDiffSchema[] = [];

  const oldDateFormat = oldData?.dateFormat ?? '';
  const oldMessage = oldData?.message ?? '';
  const oldSubject = oldData?.subject ?? '';
  const oldTimezone = oldData?.timezone ?? '';
  const oldPassword = oldData?.password ?? null;
  const oldRedirectUrl = oldData?.redirectUrl ?? '';

  if (oldDateFormat !== newData.dateFormat) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.DATE_FORMAT,
      from: oldData?.dateFormat ?? '',
      to: newData.dateFormat,
    });
  }

  if (oldMessage !== newData.message) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.MESSAGE,
      from: oldMessage,
      to: newData.message,
    });
  }

  if (oldSubject !== newData.subject) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.SUBJECT,
      from: oldSubject,
      to: newData.subject,
    });
  }

  if (oldTimezone !== newData.timezone) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.TIMEZONE,
      from: oldTimezone,
      to: newData.timezone,
    });
  }

  if (oldRedirectUrl !== newData.redirectUrl) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.REDIRECT_URL,
      from: oldRedirectUrl,
      to: newData.redirectUrl,
    });
  }

  if (oldPassword !== newData.password) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.PASSWORD,
    });
  }

  return diffs;
};

/**
 * Formats the audit log into a description of the action.
 *
 * Provide a userId to prefix the action with the user, example 'X did Y'.
 */
export const formatDocumentAuditLogActionString = (
  auditLog: TDocumentAuditLog,
  userId?: number,
) => {
  const { prefix, description } = formatDocumentAuditLogAction(auditLog, userId);

  return prefix ? `${prefix} ${description}` : description;
};

/**
 * Formats the audit log into a description of the action.
 *
 * Provide a userId to prefix the action with the user, example 'X did Y'.
 */
export const formatDocumentAuditLogAction = (auditLog: TDocumentAuditLog, userId?: number) => {
  let prefix = userId === auditLog.userId ? 'You' : auditLog.name || auditLog.email || '';

  const description = match(auditLog)
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED }, () => ({
      anonymous: 'A field was added',
      identified: 'added a field',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED }, () => ({
      anonymous: 'A field was removed',
      identified: 'removed a field',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED }, () => ({
      anonymous: 'A field was updated',
      identified: 'updated a field',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED }, () => ({
      anonymous: 'A recipient was added',
      identified: 'added a recipient',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED }, () => ({
      anonymous: 'A recipient was removed',
      identified: 'removed a recipient',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED }, () => ({
      anonymous: 'A recipient was updated',
      identified: 'updated a recipient',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED }, () => ({
      anonymous: 'Document created',
      identified: 'created the document',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED }, () => ({
      anonymous: 'Document deleted',
      identified: 'deleted the document',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED }, () => ({
      anonymous: 'Field signed',
      identified: 'signed a field',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED }, () => ({
      anonymous: 'Field unsigned',
      identified: 'unsigned a field',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED }, () => ({
      anonymous: 'Document updated',
      identified: 'updated the document',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED }, () => ({
      anonymous: 'Document opened',
      identified: 'opened the document',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED }, () => ({
      anonymous: 'Document title updated',
      identified: 'updated the document title',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT }, () => ({
      anonymous: 'Document sent',
      identified: 'sent the document',
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED }, ({ data }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const action = RECIPIENT_ROLES_DESCRIPTION[data.recipientRole as RecipientRole]?.actioned;

      const value = action ? `${action.toLowerCase()} the document` : 'completed their task';

      return {
        anonymous: `Recipient ${value}`,
        identified: value,
      };
    })
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT }, ({ data }) => ({
      anonymous: `Email ${data.isResending ? 'resent' : 'sent'}`,
      identified: `${data.isResending ? 'resent' : 'sent'} an email`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED }, () => {
      // Clear the prefix since this should be considered an 'anonymous' event.
      prefix = '';

      return {
        anonymous: 'Document completed',
        identified: 'Document completed',
      };
    })
    .exhaustive();

  return {
    prefix,
    description: prefix ? description.identified : description.anonymous,
  };
};
