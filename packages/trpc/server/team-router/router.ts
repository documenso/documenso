import { createTeamEmailVerification } from '@documenso/lib/server-only/team/create-team-email-verification';
import { deleteTeamEmail } from '@documenso/lib/server-only/team/delete-team-email';
import { deleteTeamEmailVerification } from '@documenso/lib/server-only/team/delete-team-email-verification';
import { getTeamEmailByEmail } from '@documenso/lib/server-only/team/get-team-email-by-email';
import { resendTeamEmailVerification } from '@documenso/lib/server-only/team/resend-team-email-verification';
import { updateTeamEmail } from '@documenso/lib/server-only/team/update-team-email';

import { authenticatedProcedure, router } from '../trpc';
import { createTeamRoute } from './create-team';
import { createTeamGroupsRoute } from './create-team-groups';
import { createTeamMembersRoute } from './create-team-members';
import { deleteTeamRoute } from './delete-team';
import { deleteTeamGroupRoute } from './delete-team-group';
import { deleteTeamMemberRoute } from './delete-team-member';
import { findTeamGroupsRoute } from './find-team-groups';
import { findTeamMembersRoute } from './find-team-members';
import { findTeamsRoute } from './find-teams';
import { getTeamRoute } from './get-team';
import { getTeamMembersRoute } from './get-team-members';
import {
  ZCreateTeamEmailVerificationMutationSchema,
  ZDeleteTeamEmailMutationSchema,
  ZDeleteTeamEmailVerificationMutationSchema,
  ZResendTeamEmailVerificationMutationSchema,
  ZUpdateTeamEmailMutationSchema,
} from './schema';
import { updateTeamRoute } from './update-team';
import { updateTeamGroupRoute } from './update-team-group';
import { updateTeamMemberRoute } from './update-team-member';
import { updateTeamSettingsRoute } from './update-team-settings';

export const teamRouter = router({
  find: findTeamsRoute,
  get: getTeamRoute,
  create: createTeamRoute,
  update: updateTeamRoute,
  delete: deleteTeamRoute,
  member: {
    find: findTeamMembersRoute,
    getMany: getTeamMembersRoute,
    createMany: createTeamMembersRoute,
    update: updateTeamMemberRoute,
    delete: deleteTeamMemberRoute,
  },
  group: {
    find: findTeamGroupsRoute,
    createMany: createTeamGroupsRoute,
    update: updateTeamGroupRoute,
    delete: deleteTeamGroupRoute,
  },
  settings: {
    update: updateTeamSettingsRoute,
  },

  // Old routes (to be migrated)
  // Todo: Refactor into routes.
  email: {
    get: authenticatedProcedure.query(async ({ ctx }) => {
      return await getTeamEmailByEmail({ email: ctx.user.email });
    }),
    update: authenticatedProcedure
      .input(ZUpdateTeamEmailMutationSchema)
      .mutation(async ({ input, ctx }) => {
        ctx.logger.info({
          input: {
            teamId: input.teamId,
          },
        });

        return await updateTeamEmail({
          userId: ctx.user.id,
          ...input,
        });
      }),
    delete: authenticatedProcedure
      .input(ZDeleteTeamEmailMutationSchema)
      .mutation(async ({ input, ctx }) => {
        const { teamId } = input;

        ctx.logger.info({
          input: {
            teamId,
          },
        });

        return await deleteTeamEmail({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          teamId,
        });
      }),
    verification: {
      send: authenticatedProcedure
        .input(ZCreateTeamEmailVerificationMutationSchema)
        .mutation(async ({ input, ctx }) => {
          const { teamId, email, name } = input;

          ctx.logger.info({
            input: {
              teamId,
            },
          });

          return await createTeamEmailVerification({
            teamId,
            userId: ctx.user.id,
            data: {
              email,
              name,
            },
          });
        }),
      resend: authenticatedProcedure
        .input(ZResendTeamEmailVerificationMutationSchema)
        .mutation(async ({ input, ctx }) => {
          const { teamId } = input;

          ctx.logger.info({
            input: {
              teamId,
            },
          });

          await resendTeamEmailVerification({
            userId: ctx.user.id,
            teamId,
          });
        }),
      delete: authenticatedProcedure
        .input(ZDeleteTeamEmailVerificationMutationSchema)
        .mutation(async ({ input, ctx }) => {
          const { teamId } = input;

          ctx.logger.info({
            input: {
              teamId,
            },
          });

          return await deleteTeamEmailVerification({
            userId: ctx.user.id,
            teamId,
          });
        }),
    },
  },
});
