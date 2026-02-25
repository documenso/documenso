import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { DocumentAuditLog, DocumentMeta, Field, Recipient } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import { isDeepEqual } from 'remeda';
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
  envelopeId: string;
  type: T;
  data: Extract<TDocumentAuditLog, { type: T }>['data'];
  user?: { email?: string | null; id?: number | null; name?: string | null } | null;
  requestMetadata?: RequestMetadata;
  metadata?: ApiRequestMetadata;
};

export type CreateDocumentAuditLogDataResponse = Pick<
  DocumentAuditLog,
  'type' | 'ipAddress' | 'userAgent' | 'email' | 'userId' | 'name' | 'envelopeId'
> & {
  data: TDocumentAuditLog['data'];
};

export const createDocumentAuditLogData = <T extends TDocumentAuditLog['type']>({
  envelopeId,
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
    envelopeId,
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

  if (!isDeepEqual(oldAccessAuth, newAccessAuth)) {
    diffs.push({
      type: RECIPIENT_DIFF_TYPE.ACCESS_AUTH,
      from: oldAccessAuth ?? '',
      to: newAccessAuth ?? '',
    });
  }

  if (!isDeepEqual(oldActionAuth, newActionAuth)) {
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
  const oldRedirectUrl = oldData?.redirectUrl ?? '';
  const oldEmailId = oldData?.emailId || null;
  const oldEmailReplyTo = oldData?.emailReplyTo || null;
  const oldEmailSettings = oldData?.emailSettings || null;

  const newDateFormat = newData?.dateFormat ?? '';
  const newMessage = newData?.message ?? '';
  const newSubject = newData?.subject ?? '';
  const newTimezone = newData?.timezone ?? '';
  const newRedirectUrl = newData?.redirectUrl ?? '';
  const newEmailId = newData?.emailId || null;
  const newEmailReplyTo = newData?.emailReplyTo || null;
  const newEmailSettings = newData?.emailSettings || null;

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

  if (oldEmailId !== newEmailId) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.EMAIL_ID,
      from: oldEmailId,
      to: newEmailId,
    });
  }

  if (oldEmailReplyTo !== newEmailReplyTo) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.EMAIL_REPLY_TO,
      from: oldEmailReplyTo,
      to: newEmailReplyTo,
    });
  }

  if (!isDeepEqual(oldEmailSettings, newEmailSettings)) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.EMAIL_SETTINGS,
      from: JSON.stringify(oldEmailSettings),
      to: JSON.stringify(newEmailSettings),
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
  i18n: I18n,
  auditLog: TDocumentAuditLog,
  userId?: number,
) => {
  const isCurrentUser = userId === auditLog.userId;
  const user = auditLog.name || auditLog.email || '';

  const prefix = isCurrentUser ? i18n._(msg`You`) : user || '';

  const description = match(auditLog)
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED }, () => ({
      anonymous: msg({
        message: `A field was added`,
        context: `Audit log format`,
      }),
      you: msg`You added a field`,
      user: msg`${user} added a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED }, () => ({
      anonymous: msg({
        message: `A field was removed`,
        context: `Audit log format`,
      }),
      you: msg`You removed a field`,
      user: msg`${user} removed a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED }, () => ({
      anonymous: msg({
        message: `A field was updated`,
        context: `Audit log format`,
      }),
      you: msg`You updated a field`,
      user: msg`${user} updated a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED }, () => ({
      anonymous: msg({
        message: `A recipient was added`,
        context: `Audit log format`,
      }),
      you: msg`You added a recipient`,
      user: msg`${user} added a recipient`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED }, () => ({
      anonymous: msg({
        message: `A recipient was removed`,
        context: `Audit log format`,
      }),
      you: msg`You removed a recipient`,
      user: msg`${user} removed a recipient`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED }, () => ({
      anonymous: msg({
        message: `A recipient was updated`,
        context: `Audit log format`,
      }),
      you: msg`You updated a recipient`,
      user: msg`${user} updated a recipient`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED }, () => ({
      anonymous: msg({
        message: `Document created`,
        context: `Audit log format`,
      }),
      you: msg`You created the document`,
      user: msg`${user} created the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED }, () => ({
      anonymous: msg({
        message: `Document deleted`,
        context: `Audit log format`,
      }),
      you: msg`You deleted the document`,
      user: msg`${user} deleted the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELDS_AUTO_INSERTED }, () => ({
      anonymous: msg({
        message: `System auto inserted fields`,
        context: `Audit log format`,
      }),
      you: msg({
        message: `System auto inserted fields`,
        context: `Audit log format`,
      }),
      user: msg({
        message: `System auto inserted fields`,
        context: `Audit log format`,
      }),
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED }, () => ({
      anonymous: msg({
        message: `Field signed`,
        context: `Audit log format`,
      }),
      you: msg`You signed a field`,
      user: msg`${user} signed a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED }, () => ({
      anonymous: msg({
        message: `Field unsigned`,
        context: `Audit log format`,
      }),
      you: msg`You unsigned a field`,
      user: msg`${user} unsigned a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_PREFILLED }, () => ({
      anonymous: msg({
        message: `Field prefilled by assistant`,
        context: `Audit log format`,
      }),
      you: msg`You prefilled a field`,
      user: msg`${user} prefilled a field`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_VISIBILITY_UPDATED }, () => ({
      anonymous: msg({
        message: `Document visibility updated`,
        context: `Audit log format`,
      }),
      you: msg`You updated the document visibility`,
      user: msg`${user} updated the document visibility`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_GLOBAL_AUTH_ACCESS_UPDATED }, () => ({
      anonymous: msg({
        message: `Document access auth updated`,
        context: `Audit log format`,
      }),
      you: msg`You updated the document access auth requirements`,
      user: msg`${user} updated the document access auth requirements`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_GLOBAL_AUTH_ACTION_UPDATED }, () => ({
      anonymous: msg({
        message: `Document signing auth updated`,
        context: `Audit log format`,
      }),
      you: msg`You updated the document signing auth requirements`,
      user: msg`${user} updated the document signing auth requirements`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED }, () => ({
      anonymous: msg({
        message: `Document updated`,
        context: `Audit log format`,
      }),
      you: msg`You updated the document`,
      user: msg`${user} updated the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED }, () => ({
      anonymous: msg({
        message: `Document opened`,
        context: `Audit log format`,
      }),
      you: msg`You opened the document`,
      user: msg`${user} opened the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_VIEWED }, () => ({
      anonymous: msg({
        message: `Document viewed`,
        context: `Audit log format`,
      }),
      you: msg`You viewed the document`,
      user: msg`${user} viewed the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED }, () => ({
      anonymous: msg({
        message: `Document title updated`,
        context: `Audit log format`,
      }),
      you: msg`You updated the document title`,
      user: msg`${user} updated the document title`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_EXTERNAL_ID_UPDATED }, () => ({
      anonymous: msg({
        message: `Document external ID updated`,
        context: `Audit log format`,
      }),
      you: msg`You updated the document external ID`,
      user: msg`${user} updated the document external ID`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT }, () => ({
      anonymous: msg({
        message: `Document sent`,
        context: `Audit log format`,
      }),
      you: msg`You sent the document`,
      user: msg`${user} sent the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_MOVED_TO_TEAM }, () => ({
      anonymous: msg({
        message: `Document moved to team`,
        context: `Audit log format`,
      }),
      you: msg`You moved the document to team`,
      user: msg`${user} moved the document to team`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED }, ({ data }) => {
      return match(data.recipientRole)
        .with(RecipientRole.SIGNER, () => ({
          anonymous: msg`Recipient signed the document`,
          you: msg`You signed the document`,
          user: msg`${user} signed the document`,
        }))
        .with(RecipientRole.VIEWER, () => ({
          anonymous: msg`Recipient viewed the document`,
          you: msg`You viewed the document`,
          user: msg`${user} viewed the document`,
        }))
        .with(RecipientRole.APPROVER, () => ({
          anonymous: msg`Recipient approved the document`,
          you: msg`You approved the document`,
          user: msg`${user} approved the document`,
        }))
        .with(RecipientRole.CC, () => ({
          anonymous: msg`Recipient CC'd the document`,
          you: msg`You CC'd the document`,
          user: msg`${user} CC'd the document`,
        }))
        .otherwise(() => ({
          anonymous: msg`Recipient completed their task`,
          you: msg`You completed your task`,
          user: msg`${user} completed their task`,
        }));
    })
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED }, () => ({
      anonymous: msg`Recipient rejected the document`,
      you: msg`You rejected the document`,
      user: msg`${user} rejected the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_REQUESTED }, () => ({
      anonymous: msg`Recipient requested a 2FA token for the document`,
      you: msg`You requested a 2FA token for the document`,
      user: msg`${user} requested a 2FA token for the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_VALIDATED }, () => ({
      anonymous: msg`Recipient validated a 2FA token for the document`,
      you: msg`You validated a 2FA token for the document`,
      user: msg`${user} validated a 2FA token for the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_FAILED }, () => ({
      anonymous: msg`Recipient failed to validate a 2FA token for the document`,
      you: msg`You failed to validate a 2FA token for the document`,
      user: msg`${user} failed to validate a 2FA token for the document`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT }, ({ data }) => {
      if (data.isResending) {
        return {
          anonymous: msg({
            message: `Email resent`,
            context: `Audit log format`,
          }),
          you: msg`You resent an email to ${data.recipientEmail}`,
          user: msg`${user} resent an email to ${data.recipientEmail}`,
        };
      }
      return {
        anonymous: msg({
          message: `Email sent`,
          context: `Audit log format`,
        }),
        you: msg`You sent an email to ${data.recipientEmail}`,
        user: msg`${user} sent an email to ${data.recipientEmail}`,
      };
    })
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED }, () => ({
      anonymous: msg({ message: `Document completed`, context: `Audit log format` }),
      you: msg({ message: `Document completed`, context: `Audit log format` }),
      user: msg({ message: `Document completed`, context: `Audit log format` }),
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_CREATED }, ({ data }) => ({
      anonymous: msg({
        message: `Envelope item created`,
        context: `Audit log format`,
      }),
      you: msg`You created an envelope item with title ${data.envelopeItemTitle}`,
      user: msg`${user} created an envelope item with title ${data.envelopeItemTitle}`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_DELETED }, ({ data }) => ({
      anonymous: msg({
        message: `Envelope item deleted`,
        context: `Audit log format`,
      }),
      you: msg`You deleted an envelope item with title ${data.envelopeItemTitle}`,
      user: msg`${user} deleted an envelope item with title ${data.envelopeItemTitle}`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_EXPIRED }, ({ data }) => ({
      anonymous: msg({
        message: `Recipient signing window expired`,
        context: `Audit log format`,
      }),
      you: msg`Signing window expired for ${data.recipientName || data.recipientEmail}`,
      user: msg`Signing window expired for ${data.recipientName || data.recipientEmail}`,
    }))
    .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELEGATED_OWNER_CREATED }, ({ data }) => {
      const message = msg({
        message: `The document ownership was delegated to ${data.delegatedOwnerName || data.delegatedOwnerEmail} on behalf of ${data.teamName}`,
        context: `Audit log format`,
      });
      return {
        anonymous: message,
        you: message,
        user: message,
      };
    })
    .exhaustive();

  let selectedDescription = description.anonymous;

  if (isCurrentUser) {
    selectedDescription = description.you;
  } else if (user) {
    selectedDescription = description.user;
  }

  return {
    prefix,
    description: i18n._(selectedDescription),
  };
};
