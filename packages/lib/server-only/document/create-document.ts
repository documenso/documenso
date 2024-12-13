'use server';

import type { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { DocumentSource, DocumentVisibility, WebhookTriggerEvents } from '@documenso/prisma/client';
import type { Team, TeamGlobalSettings } from '@documenso/prisma/client';
import { TeamMemberRole } from '@documenso/prisma/client';
import { DocumentSchema } from '@documenso/prisma/generated/zod';

import { ZWebhookDocumentSchema } from '../../types/webhook-payload';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type CreateDocumentOptions = {
  title: string;
  externalId?: string | null;
  userId: number;
  teamId?: number;
  documentDataId: string;
  formValues?: Record<string, string | number | boolean>;
  requestMetadata?: RequestMetadata;
};

export const ZCreateDocumentResponseSchema = DocumentSchema;

export type TCreateDocumentResponse = z.infer<typeof ZCreateDocumentResponseSchema>;

export const createDocument = async ({
  userId,
  title,
  externalId,
  documentDataId,
  teamId,
  formValues,
  requestMetadata,
}: CreateDocumentOptions): Promise<TCreateDocumentResponse> => {
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

  const determineVisibility = (
    globalVisibility: DocumentVisibility | null | undefined,
    userRole: TeamMemberRole,
  ): DocumentVisibility => {
    const defaultVisibility = globalVisibility ?? DocumentVisibility.EVERYONE;

    if (userRole === TeamMemberRole.ADMIN) {
      return defaultVisibility;
    }

    if (userRole === TeamMemberRole.MANAGER) {
      if (defaultVisibility === DocumentVisibility.ADMIN) {
        return DocumentVisibility.MANAGER_AND_ABOVE;
      }
      return defaultVisibility;
    }

    return DocumentVisibility.EVERYONE;
  };

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title,
        externalId,
        documentDataId,
        userId,
        teamId,
        visibility: determineVisibility(
          team?.teamGlobalSettings?.documentVisibility,
          userTeamRole ?? TeamMemberRole.MEMBER,
        ),
        formValues,
        source: DocumentSource.DOCUMENT,
        documentMeta: {
          create: {
            language: team?.teamGlobalSettings?.documentLanguage,
            typedSignatureEnabled: team?.teamGlobalSettings?.typedSignatureEnabled,
          },
        },
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        documentId: document.id,
        user,
        requestMetadata,
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
        Recipient: true,
      },
    });

    if (!createdDocument) {
      throw new Error('Document not found');
    }

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      data: ZWebhookDocumentSchema.parse(createdDocument),
      userId,
      teamId,
    });

    return createdDocument;
  });
};
