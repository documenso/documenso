import { TeamMemberRole } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { orphanEnvelopes } from '@documenso/lib/server-only/envelope/orphan-envelopes';
import { transferTeamEnvelopes } from '@documenso/lib/server-only/envelope/transfer-team-envelopes';
import { deleteTeam } from '@documenso/lib/server-only/team/delete-team';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';

import { authenticatedProcedure } from '../trpc';
import { ZDeleteTeamRequestSchema, ZDeleteTeamResponseSchema } from './delete-team.types';

export const deleteTeamRoute = authenticatedProcedure
  // .meta(deleteTeamMeta)
  .input(ZDeleteTeamRequestSchema)
  .output(ZDeleteTeamResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, transferTeamId } = input;
    const { user } = ctx;

    const team = await getTeamById({ userId: user.id, teamId });

    if (team.currentTeamRole !== TeamMemberRole.ADMIN) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to delete this team',
      });
    }

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    const transferTeam = transferTeamId
      ? await getTeamById({ userId: user.id, teamId: transferTeamId }).catch(() => {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'Invalid transfer team ID',
          });
        })
      : undefined;

    if (transferTeam) {
      await transferTeamEnvelopes({
        sourceTeamId: teamId,
        targetTeamId: transferTeam.id,
      });
    } else {
      await orphanEnvelopes({ teamId });
    }

    await deleteTeam({
      userId: user.id,
      teamId,
    });
  });
