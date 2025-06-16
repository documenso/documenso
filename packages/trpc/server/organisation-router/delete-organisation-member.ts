import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationMemberRequestSchema,
  ZDeleteOrganisationMemberResponseSchema,
} from './delete-organisation-member.types';
import { deleteOrganisationMembers } from './delete-organisation-members';

export const deleteOrganisationMemberRoute = authenticatedProcedure
  //   .meta(deleteOrganisationMemberMeta)
  .input(ZDeleteOrganisationMemberRequestSchema)
  .output(ZDeleteOrganisationMemberResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, organisationMemberId } = input;
    const userId = ctx.user.id;

    await deleteOrganisationMembers({
      userId,
      organisationId,
      organisationMemberIds: [organisationMemberId],
    });
  });
