import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

export type AdminSuperDeleteDocumentOptions = {
  envelopeId: string;
  reason: string;
  requestMetadata?: RequestMetadata;
};

export const adminSuperDeleteDocument = async ({
  envelopeId,
  reason,
  requestMetadata,
}: AdminSuperDeleteDocumentOptions) => {
  const envelope = await prisma.envelope.findUnique({
    where: {
      id: envelopeId,
    },
    include: {
      documentMeta: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const { user } = envelope;

  const isDocumentDeletedEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).documentDeleted;

  // Always hard delete if deleted from admin.
  const deletedEnvelope = await prisma.$transaction(async (tx) => {
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        envelopeId,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
        user,
        requestMetadata,
        data: {
          type: 'HARD',
        },
      }),
    });

    return await tx.envelope.delete({ where: { id: envelopeId } });
  });

  // Notify the document owner after the hard delete transaction commits.
  // We only send the owner notification; recipient cancellation emails are
  // omitted because the recipients are hard-deleted with the envelope.
  if (isDocumentDeletedEmailEnabled) {
    await jobs.triggerJob({
      name: 'send.document.super.delete.email',
      payload: {
        userId: user.id,
        documentTitle: envelope.title,
        reason,
        teamId: envelope.teamId,
      },
    });
  }

  return deletedEnvelope;
};
