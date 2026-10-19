import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { twoFactorInstanceOnly } from '../two-factor-enforcement/enforce';
import {
  ZGetOrganisationMemberInvitesRequestSchema,
  ZGetOrganisationMemberInvitesResponseSchema,
} from './get-organisation-member-invites.types';

export const getOrganisationMemberInvitesRoute = authenticatedProcedure
  //   .meta(getOrganisationMemberInvitesMeta)
  .input(ZGetOrganisationMemberInvitesRequestSchema)
  .output(ZGetOrganisationMemberInvitesResponseSchema)
  // The user's own pending invites, needed to accept/decline while blocked.
  .use(twoFactorInstanceOnly())
  .query(async ({ input, ctx }) => {
    const { user } = ctx;

    const { status } = input;

    return await prisma.organisationMemberInvite.findMany({
      where: {
        email: user.email,
        status,
      },
      include: {
        organisation: {
          select: {
            id: true,
            name: true,
            url: true,
            avatarImageId: true,
          },
        },
      },
    });
  });
