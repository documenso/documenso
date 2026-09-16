import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  ZDeleteOrganisationMemberRequestSchema,
  ZDeleteOrganisationMemberResponseSchema,
} from './delete-organisation-member.types';
import { deleteOrganisationMembers } from './delete-organisation-members';

export const deleteOrganisationMemberRoute = authenticatedProcedure
  //   .meta(deleteOrganisationMemberMeta)
  .input(ZDeleteOrganisationMemberRequestSchema)
  .output(ZDeleteOrganisationMemberResponseSchema)
  .use(twoFactorScope((input) => ({ organisation: input.organisationId })))
  .mutation(async ({ ctx, input }) => {
    const { organisationId, organisationMemberId } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
        organisationMemberId,
      },
    });

    await deleteOrganisationMembers({
      userId,
      organisationId,
      organisationMemberIds: [organisationMemberId],
    });
  });
