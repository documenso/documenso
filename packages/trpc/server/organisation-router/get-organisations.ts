import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationsRequestSchema,
  ZGetOrganisationsResponseSchema,
} from './get-organisations.types';

export const getOrganisationsRoute = authenticatedProcedure
  //   .meta(getOrganisationsMeta)
  .input(ZGetOrganisationsRequestSchema)
  .output(ZGetOrganisationsResponseSchema)
  .query(async ({ ctx }) => {
    const { user } = ctx;

    return getOrganisations({ userId: user.id });
  });

export const getOrganisations = async ({ userId }: { userId: number }) => {
  const organisations = await prisma.organisation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        where: {
          userId,
        },
      },
      groups: {
        where: {
          organisationGroupMembers: {
            some: {
              organisationMember: {
                userId,
              },
            },
          },
        },
      },
    },
  });

  return organisations.map(({ groups, ...organisation }) => {
    const currentOrganisationRole = getHighestOrganisationRoleInGroup(groups);

    return {
      ...organisation,
      currentOrganisationRole: currentOrganisationRole,
      currentMemberId: organisation.members[0].id,
    };
  });
};
