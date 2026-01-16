import { EnvelopeType, FolderType } from '@prisma/client';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMultipleEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZBulkMoveDocumentsRequestSchema,
  ZBulkMoveDocumentsResponseSchema,
  bulkMoveDocumentsMeta,
} from './bulk-move-documents.types';

export const bulkMoveDocumentsRoute = authenticatedProcedure
  .meta(bulkMoveDocumentsMeta)
  .input(ZBulkMoveDocumentsRequestSchema)
  .output(ZBulkMoveDocumentsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { documentIds, folderId } = input;

    ctx.logger.info({
      input: {
        documentIds,
        folderId,
      },
    });

    const { envelopeWhereInput, team } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'documentId',
        ids: documentIds,
      },
      userId: user.id,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    // Validate folder access if moving to a folder (not root).
    if (folderId) {
      if (!team.currentTeamRole) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'Team context is required to move documents to a folder',
        });
      }

      const folder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          team: buildTeamWhereQuery({
            teamId,
            userId: user.id,
          }),
          type: FolderType.DOCUMENT,
          visibility: {
            in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
          },
        },
      });

      if (!folder) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Folder not found or access denied',
        });
      }
    }

    const result = await prisma.envelope.updateMany({
      where: envelopeWhereInput,
      data: {
        folderId: folderId,
      },
    });

    return {
      movedCount: result.count,
    };
  });
