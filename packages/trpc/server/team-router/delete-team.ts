import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { orphanEnvelopes } from '@documenso/lib/server-only/envelope/orphan-envelopes';
import { transferTeamEnvelopes } from '@documenso/lib/server-only/envelope/transfer-team-envelopes';
import { deleteTeam } from '@documenso/lib/server-only/team/delete-team';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { TeamMemberRole } from '@prisma/client';

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

    // Being a member of the target team is not enough: a user can belong to teams in several
    // organisations, and documents must not leave the organisation that owns them.
    //
    // The target cannot be the team being deleted either. Moving a team's documents to itself moves
    // nothing, and because a target was given orphanEnvelopes never runs, so the pending and
    // completed documents it would have kept are deleted together with the team.
    if (transferTeam && (transferTeam.id === team.id || transferTeam.organisationId !== team.organisationId)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid transfer team ID',
      });
    }

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
