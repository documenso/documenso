import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { DocumentAuditLog, DocumentMeta, Field, Recipient } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import { match } from 'ts-pattern';

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
import { ZRecipientAuthOptionsSchema } from '../types/document-auth';
import type { ApiRequestMetadata, RequestMetadata } from '../universal/extract-request-metadata';

type CreateDocumentAuditLogDataOptions<T = TDocumentAuditLog['type']> = {
  documentId: number;
  type: T;
  data: Extract<TDocumentAuditLog, { type: T }>['data'];
  user?: { email?: string | null; id?: number | null; name?: string | null } | null;
  requestMetadata?: RequestMetadata;
  metadata?: ApiRequestMetadata;
};

export type CreateDocumentAuditLogDataResponse = Pick<
  DocumentAuditLog,
  'type' | 'ipAddress' | 'userAgent' | 'email' | 'userId' | 'name' | 'documentId'
> & {
  data: TDocumentAuditLog['data'];
};

export const createDocumentAuditLogData = <T extends TDocumentAuditLog['type']>({
  documentId,
  type,
  data,
  user,
  requestMetadata,
  metadata,
}: CreateDocumentAuditLogDataOptions<T>): CreateDocumentAuditLogDataResponse => {
  let userId: number | null = metadata?.auditUser?.id || null;
  let email: string | null = metadata?.auditUser?.email || null;
  let name: string | null = metadata?.auditUser?.name || null;

  // Prioritize explicit user parameter over metadata audit user.
  if (user) {
    userId = user.id || null;
    email = user.email || null;
    name = user.name || null;
  }

  const ipAddress = metadata?.requestMetadata.ipAddress ?? requestMetadata?.ipAddress ?? null;
  const userAgent = metadata?.requestMetadata.userAgent ?? requestMetadata?.userAgent ?? null;

  return {
    type,
    data,
    documentId,
    userId,
    email,
    name,
    userAgent,
    ipAddress,
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
    // Todo: Alert us.
    console.error(data.error);
    throw new Error('Migration required');
  }

  return data.data;
};

type PartialRecipient = Pick<Recipient, 'email' | 'name' | 'role' | 'authOptions'>;

export const diffRecipientChanges = (
  oldRecipient: PartialRecipient,
  newRecipient: PartialRecipient,
): TDocumentAuditLogRecipientDiffSchema[] => {
  const diffs: TDocumentAuditLogRecipientDiffSchema[] = [];

  const oldAuthOptions = ZRecipientAuthOptionsSchema.parse(oldRecipient.authOptions);
  const oldAccessAuth = oldAuthOptions.accessAuth;
  const oldActionAuth = oldAuthOptions.actionAuth;

  const newAuthOptions = ZRecipientAuthOptionsSchema.parse(newRecipient.authOptions);
  const newAccessAuth =
    newAuthOptions?.accessAuth === undefined ? oldAccessAuth : newAuthOptions.accessAuth;
  const newActionAuth =
    newAuthOptions?.actionAuth === undefined ? oldActionAuth : newAuthOptions.actionAuth;

  if (oldAccessAuth !== newAccessAuth) {
    diffs.push({
      type: RECIPIENT_DIFF_TYPE.ACCESS_AUTH,
      from: oldAccessAuth ?? '',
      to: newAccessAuth ?? '',
    });
  }

  if (oldActionAuth !== newActionAuth) {
    diffs.push({
      type: RECIPIENT_DIFF_TYPE.ACTION_AUTH,
      from: oldActionAuth ?? '',
      to: newActionAuth ?? '',
    });
  }

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

  const newDateFormat = newData?.dateFormat ?? '';
  const newMessage = newData?.message ?? '';
  const newSubject = newData?.subject ?? '';
  const newTimezone = newData?.timezone ?? '';
  const newRedirectUrl = newData?.redirectUrl ?? '';

  if (oldDateFormat !== newDateFormat) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.DATE_FORMAT,
      from: oldData?.dateFormat ?? '',
      to: newData.dateFormat,
    });
  }

  if (oldMessage !== newMessage) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.MESSAGE,
      from: oldMessage,
      to: newMessage,
    });
  }

  if (oldSubject !== newSubject) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.SUBJECT,
      from: oldSubject,
      to: newSubject,
    });
  }

  if (oldTimezone !== newTimezone) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.TIMEZONE,
      from: oldTimezone,
      to: newTimezone,
    });
  }

  if (oldRedirectUrl !== newRedirectUrl) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.REDIRECT_URL,
      from: oldRedirectUrl,
      to: newRedirectUrl,
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
export const formatDocumentAuditLogAction = (
  _: I18n['_'],
  auditLog: TDocumentAuditLog,
  userId?: number,
) => {
  const prefix = userId === auditLog.userId ? _(msg`You`) : auditLog.name || auditLog.email || '';

  const description = match(auditLog)
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED }, () => ({
      anonymous: msg`A field was added`,
      identified: msg`${prefix} added a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED }, () => ({
      anonymous: msg`A field was removed`,
      identified: msg`${prefix} removed a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED }, () => ({
      anonymous: msg`A field was updated`,
      identified: msg`${prefix} updated a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED }, () => ({
      anonymous: msg`A recipient was added`,
      identified: msg`${prefix} added a recipient`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED }, () => ({
      anonymous: msg`A recipient was removed`,
      identified: msg`${prefix} removed a recipient`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED }, () => ({
      anonymous: msg`A recipient was updated`,
      identified: msg`${prefix} updated a recipient`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED }, () => ({
      anonymous: msg`Document created`,
      identified: msg`${prefix} created the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED }, () => ({
      anonymous: msg`Document deleted`,
      identified: msg`${prefix} deleted the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED }, () => ({
      anonymous: msg`Field signed`,
      identified: msg`${prefix} signed a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED }, () => ({
      anonymous: msg`Field unsigned`,
      identified: msg`${prefix} unsigned a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_PREFILLED }, () => ({
      anonymous: msg`Field prefilled by assistant`,
      identified: msg`${prefix} prefilled a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_VISIBILITY_UPDATED }, () => ({
      anonymous: msg`Document visibility updated`,
      identified: msg`${prefix} updated the document visibility`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_GLOBAL_AUTH_ACCESS_UPDATED }, () => ({
      anonymous: msg`Document access auth updated`,
      identified: msg`${prefix} updated the document access auth requirements`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_GLOBAL_AUTH_ACTION_UPDATED }, () => ({
      anonymous: msg`Document signing auth updated`,
      identified: msg`${prefix} updated the document signing auth requirements`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED }, () => ({
      anonymous: msg`Document updated`,
      identified: msg`${prefix} updated the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED }, () => ({
      anonymous: msg`Document opened`,
      identified: msg`${prefix} opened the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED }, () => ({
      anonymous: msg`Document title updated`,
      identified: msg`${prefix} updated the document title`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_EXTERNAL_ID_UPDATED }, () => ({
      anonymous: msg`Document external ID updated`,
      identified: msg`${prefix} updated the document external ID`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT }, () => ({
      anonymous: msg`Document sent`,
      identified: msg`${prefix} sent the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_MOVED_TO_TEAM }, () => ({
      anonymous: msg`Document moved to team`,
      identified: msg`${prefix} moved the document to team`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED }, ({ data }) => {
      const userName = prefix || _(msg`Recipient`);

      const result = match(data.recipientRole)
        .with(RecipientRole.SIGNER, () => msg`${userName} signed the document`)
        .with(RecipientRole.VIEWER, () => msg`${userName} viewed the document`)
        .with(RecipientRole.APPROVER, () => msg`${userName} approved the document`)
        .with(RecipientRole.CC, () => msg`${userName} CC'd the document`)
        .otherwise(() => msg`${userName} completed their task`);

      return {
        anonymous: result,
        identified: result,
      };
    })
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED }, ({ data }) => {
      const userName = prefix || _(msg`Recipient`);

      const result = msg`${userName} rejected the document`;

      return {
        anonymous: result,
        identified: result,
      };
    })
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT }, ({ data }) => ({
      anonymous: data.isResending ? msg`Email resent` : msg`Email sent`,
      identified: data.isResending
        ? msg`${prefix} resent an email to ${data.recipientEmail}`
        : msg`${prefix} sent an email to ${data.recipientEmail}`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED }, () => ({
      anonymous: msg`Document completed`,
      identified: msg`Document completed`,
    }))
    .exhaustive();

  return {
    prefix,
    description: _(prefix ? description.identified : description.anonymous),
  };
};
