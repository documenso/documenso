import { TRPCError } from '@trpc/server';

import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

export type MoveDocumentToTeamOptions = {
  documentId: number;
  teamId: number;
  userId: number;
  requestMetadata?: RequestMetadata;
};

export const moveDocumentToTeam = async ({
  documentId,
  teamId,
  userId,
  requestMetadata,
}: MoveDocumentToTeamOptions) => {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const document = await tx.document.findFirst({
      where: {
        id: documentId,
        userId,
        teamId: null, // Ensure the document is not already associated with a team
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

    return updatedDocument;
  });
};
