import { DocumentSource, WebhookTriggerEvents } from '@prisma/client';
import type { Team, TeamGlobalSettings } from '@prisma/client';
import { TeamMemberRole } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { normalizePdf as makeNormalizedPdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { determineDocumentVisibility } from '../../utils/document-visibility';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type CreateDocumentOptions = {
  title: string;
  externalId?: string | null;
  userId: number;
  teamId?: number;
  documentDataId: string;
  formValues?: Record<string, string | number | boolean>;
  normalizePdf?: boolean;
  timezone?: string;
  requestMetadata: ApiRequestMetadata;
};

export const createDocument = async ({
  userId,
  title,
  externalId,
  documentDataId,
  teamId,
  normalizePdf,
  formValues,
  requestMetadata,
  timezone,
}: CreateDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      teamMembers: {
        select: {
          teamId: true,
        },
      },
    },
  });

  if (
    teamId !== undefined &&
    !user.teamMembers.some((teamMember) => teamMember.teamId === teamId)
  ) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  let team: (Team & { teamGlobalSettings: TeamGlobalSettings | null }) | null = null;
  let userTeamRole: TeamMemberRole | undefined;

  if (teamId) {
    const teamWithUserRole = await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
      },
      include: {
        teamGlobalSettings: true,
        members: {
          where: {
            userId: userId,
          },
          select: {
            role: true,
          },
        },
      },
    });

    team = teamWithUserRole;
    userTeamRole = teamWithUserRole.members[0]?.role;
  }

  if (normalizePdf) {
    const documentData = await prisma.documentData.findFirst({
      where: {
        id: documentDataId,
      },
    });

    if (documentData) {
      const buffer = await getFileServerSide(documentData);

      const normalizedPdf = await makeNormalizedPdf(Buffer.from(buffer));

      const newDocumentData = await putPdfFileServerSide({
        name: title.endsWith('.pdf') ? title : `${title}.pdf`,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(normalizedPdf),
      });

      // eslint-disable-next-line require-atomic-updates
      documentDataId = newDocumentData.id;
    }
  }

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title,
        externalId,
        documentDataId,
        userId,
        teamId,
        visibility: determineDocumentVisibility(
          team?.teamGlobalSettings?.documentVisibility,
          userTeamRole ?? TeamMemberRole.MEMBER,
        ),
        formValues,
        source: DocumentSource.DOCUMENT,
        documentMeta: {
          create: {
            language: team?.teamGlobalSettings?.documentLanguage,
            timezone: timezone,
            typedSignatureEnabled: team?.teamGlobalSettings?.typedSignatureEnabled ?? true,
            uploadSignatureEnabled: team?.teamGlobalSettings?.uploadSignatureEnabled ?? true,
            drawSignatureEnabled: team?.teamGlobalSettings?.drawSignatureEnabled ?? true,
          },
        },
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        documentId: document.id,
        metadata: requestMetadata,
        data: {
          title,
          source: {
            type: DocumentSource.DOCUMENT,
          },
        },
      }),
    });

    const createdDocument = await tx.document.findFirst({
      where: {
        id: document.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });

    if (!createdDocument) {
      throw new Error('Document not found');
    }

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(createdDocument)),
      userId,
      teamId,
    });

    return createdDocument;
  });
};
