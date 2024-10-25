'use server';

import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { DocumentSource, DocumentVisibility, WebhookTriggerEvents } from '@documenso/prisma/client';
import type { Team, TeamGlobalSettings, TeamMemberRole } from '@documenso/prisma/client';

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

export const createDocument = async ({
  userId,
  title,
  externalId,
  documentDataId,
  teamId,
  formValues,
  requestMetadata,
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
    throw new AppError(AppErrorCode.NOT_FOUND, 'Team not found');
  }

  let team: Team & { teamGlobalSettings: TeamGlobalSettings | null };
  let userTeamRole: TeamMemberRole;

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
  ): DocumentVisibility =>
    match({ globalVisibility, userRole })
      .with({ globalVisibility: DocumentVisibility.ADMIN }, ({ userRole }) =>
        match(userRole)
          .with('ADMIN', () => DocumentVisibility.ADMIN)
          .with('MANAGER', () => DocumentVisibility.MANAGER_AND_ABOVE)
          .otherwise(() => DocumentVisibility.EVERYONE),
      )
      .otherwise(({ globalVisibility }) => globalVisibility ?? DocumentVisibility.EVERYONE);

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title,
        externalId,
        documentDataId,
        userId,
        teamId,
        visibility: determineVisibility(team?.teamGlobalSettings?.documentVisibility, userTeamRole),
        formValues,
        source: DocumentSource.DOCUMENT,
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

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      data: document,
      userId,
      teamId,
    });

    return document;
  });
};
