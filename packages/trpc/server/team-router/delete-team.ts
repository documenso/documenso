import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { handleDocumentOwnershipOnDeletion } from '@documenso/lib/server-only/document/handle-document-ownership-on-deletion';
import { deleteTeam } from '@documenso/lib/server-only/team/delete-team';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZDeleteTeamRequestSchema, ZDeleteTeamResponseSchema } from './delete-team.types';

export const deleteTeamRoute = authenticatedProcedure
  // .meta(deleteTeamMeta)
  .input(ZDeleteTeamRequestSchema)
  .output(ZDeleteTeamResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = input;
    const { user } = ctx;

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId: team?.organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['DELETE_ORGANISATION'],
      }),
      select: {
        id: true,
        owner: {
          select: {
            id: true,
          },
        },
        teams: {
          select: {
            id: true,
            documents: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    const documentIds = organisation?.teams.flatMap((team) => team.documents.map((doc) => doc.id));

    if (documentIds && documentIds.length > 0 && organisation) {
      await handleDocumentOwnershipOnDeletion({
        documentIds,
        organisationOwnerId: organisation.owner.id,
      });
    }

    await deleteTeam({
      userId: user.id,
      teamId,
    });
  });
