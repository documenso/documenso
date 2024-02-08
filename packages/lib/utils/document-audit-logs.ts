import type { DocumentAuditLog, DocumentMeta, Field, Recipient } from '@documenso/prisma/client';

import type {
  TDocumentAuditLog,
  TDocumentAuditLogDocumentMetaDiffSchema,
  TDocumentAuditLogFieldDiffSchema,
  TDocumentAuditLogRecipientDiffSchema,
} from '../types/document-audit-logs';
import {
  DOCUMENT_META_DIFF_TYPE,
  FIELD_DIFF_TYPE,
  RECIPIENT_DIFF_TYPE,
  ZDocumentAuditLogSchema,
} from '../types/document-audit-logs';
import type { RequestMetadata } from '../universal/extract-request-metadata';

type CreateDocumentAuditLogDataOptions = {
  documentId: number;
  data: TDocumentAuditLog['data'];
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
  data,
  user,
  requestMetadata,
}: CreateDocumentAuditLogDataOptions): CreateDocumentAuditLogDataResponse => {
  return {
    type: data.type,
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

  if (oldData?.dateFormat !== newData.dateFormat) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.DATE_FORMAT,
      from: oldData?.dateFormat ?? '',
      to: newData.dateFormat,
    });
  }

  if (oldData?.message !== newData.message) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.MESSAGE,
      from: oldData?.message ?? '',
      to: newData.message,
    });
  }

  if (oldData?.subject !== newData.subject) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.SUBJECT,
      from: oldData?.subject ?? '',
      to: newData.subject,
    });
  }

  if (oldData?.timezone !== newData.timezone) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.TIMEZONE,
      from: oldData?.timezone ?? '',
      to: newData.timezone,
    });
  }

  if (oldData?.password !== newData.password) {
    diffs.push({
      type: DOCUMENT_META_DIFF_TYPE.PASSWORD,
    });
  }

  return diffs;
};
