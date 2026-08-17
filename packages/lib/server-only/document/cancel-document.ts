import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, EnvelopeType, WebhookTriggerEvents } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { isMemberManagerOrAbove } from '../../utils/teams';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { getMemberRoles } from '../team/get-member-roles';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type CancelDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  reason?: string;
  requestMetadata: ApiRequestMetadata;
};

export const cancelDocument = async ({ id, userId, teamId, reason, requestMetadata }: CancelDocumentOptions) => {
  // Resolve the envelope through the visibility-aware helper so the caller must
  // have read access (ownership OR team membership with sufficient visibility OR
  // team-email). This prevents cancelling a document the caller cannot see.
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    userId,
    teamId,
    type: EnvelopeType.DOCUMENT,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const isUserOwner = envelope.userId === userId;

  const teamRole = await getMemberRoles({
    teamId: envelope.teamId,
    reference: {
      type: 'User',
      id: userId,
    },
  })
    .then((roles) => roles.teamRole)
    .catch(() => null);

  const isPrivilegedTeamMember = teamRole && isMemberManagerOrAbove(teamRole);

  // The document is visible to the caller, but cancelling requires elevated permissions.
  if (!isUserOwner && !isPrivilegedTeamMember) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Not allowed',
    });
  }

  if (envelope.status !== DocumentStatus.PENDING) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only pending documents can be cancelled',
    });
  }

  const updatedEnvelope = await prisma.$transaction(async (tx) => {
    const updated = await tx.envelope.update({
      where: {
        id: envelope.id,
      },
      data: {
        status: DocumentStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        envelopeId: envelope.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CANCELLED,
        metadata: requestMetadata,
        data: {
          reason,
        },
      }),
    });

    return updated;
  });

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  // Send cancellation emails to recipients via the resilient background job.
  await jobs.triggerJob({
    name: 'send.document.cancelled.emails',
    payload: {
      documentId: legacyDocumentId,
      cancellationReason: reason,
      requestMetadata: requestMetadata.requestMetadata,
    },
  });

  // Trigger the webhook with the updated (cancelled) envelope payload.
  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_CANCELLED,
    data: ZWebhookDocumentSchema.parse(
      mapEnvelopeToWebhookDocumentPayload({
        ...envelope,
        status: updatedEnvelope.status,
        completedAt: updatedEnvelope.completedAt,
      }),
    ),
    userId,
    teamId,
  });

  return updatedEnvelope;
};
