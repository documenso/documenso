import { TRPCError } from '@trpc/server';
import type { z } from 'zod';

import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import { DocumentSchema } from '@documenso/prisma/generated/zod';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

export type MoveDocumentToTeamOptions = {
  documentId: number;
  teamId: number;
  userId: number;
  requestMetadata?: RequestMetadata;
};

export const ZMoveDocumentToTeamResponseSchema = DocumentSchema;

export type TMoveDocumentToTeamResponse = z.infer<typeof ZMoveDocumentToTeamResponseSchema>;

export const moveDocumentToTeam = async ({
  documentId,
  teamId,
  userId,
  requestMetadata,
}: MoveDocumentToTeamOptions): Promise<TMoveDocumentToTeamResponse> => {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const document = await tx.document.findFirst({
      where: {
        id: documentId,
        userId,
        teamId: null,
      },
    });

    if (!document) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Document not found or already associated with a team.',
      });
    }

    const team = await tx.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    });

    if (!team) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this team.',
      });
    }

    const updatedDocument = await tx.document.update({
      where: { id: documentId },
      data: { teamId },
    });

    const log = await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_MOVED_TO_TEAM,
        documentId: updatedDocument.id,
        user,
        requestMetadata,
        data: {
          movedByUserId: userId,
          fromPersonalAccount: true,
          toTeamId: teamId,
        },
      }),
    });

    return updatedDocument;
  });
};
