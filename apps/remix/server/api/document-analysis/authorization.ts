import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { prisma } from '@documenso/prisma';
import type { DocumentData } from '@documenso/prisma/client';

/**
 * Authorize a user's access to an envelope and return its document data.
 * Checks both direct ownership and team membership.
 */
export async function authorizeDocumentAccess(
  envelopeId: string,
  userId: number,
): Promise<DocumentData> {
  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
    },
  });

  if (!envelope || !envelope.envelopeItems || envelope.envelopeItems.length === 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Envelope not found: ${envelopeId}`,
      userMessage: 'The requested document does not exist.',
    });
  }

  const isDirectOwner = envelope.userId === userId;

  let hasTeamAccess = false;
  if (envelope.teamId) {
    try {
      await getTeamById({ teamId: envelope.teamId, userId });
      hasTeamAccess = true;
    } catch {
      hasTeamAccess = false;
    }
  }

  if (!isDirectOwner && !hasTeamAccess) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: `User ${userId} does not have access to envelope ${envelopeId}`,
      userMessage: 'You do not have permission to access this document.',
    });
  }

  const documentData = envelope.envelopeItems[0]?.documentData;

  if (!documentData) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Document data not found in envelope: ${envelopeId}`,
      userMessage: 'The requested document does not exist.',
    });
  }

  return documentData;
}
