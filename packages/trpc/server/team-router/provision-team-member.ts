import { provisionTeamMember } from '@documenso/lib/server-only/team/provision-team-member';
import { TeamMemberRole } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import {
  provisionTeamMemberMeta,
  ZProvisionTeamMemberRequestSchema,
  ZProvisionTeamMemberResponseSchema,
} from './provision-team-member.types';

export const provisionTeamMemberRoute = authenticatedProcedure
  .meta(provisionTeamMemberMeta)
  .input(ZProvisionTeamMemberRequestSchema)
  .output(ZProvisionTeamMemberResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { email, name, role, password } = input;

    ctx.logger.info({
      input: { email, role },
    });

    return await provisionTeamMember({
      callerUserId: ctx.user.id,
      teamId: ctx.teamId,
      email,
      name,
      role: TeamMemberRole[role],
      password,
    });
  });
