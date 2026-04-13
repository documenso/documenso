import type { Prisma, TeamMemberRole } from '@prisma/client';
import { EnvelopeType, TemplateType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { unsafeBuildEnvelopeIdQuery } from '../../utils/envelope';
import { getMemberRoles } from '../team/get-member-roles';
import { getTeamById } from '../team/get-team';

export type GetOrganisationTemplateByIdOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
};

/**
 * Get an organisation template by ID.
 *
 * This validates that the caller's team belongs to the same organisation as the template's team,
 * that the template is of type ORGANISATION, and that the template's visibility is permitted
 * for the caller's role on their own team.
 */
export const getOrganisationTemplateById = async ({
  id,
  userId,
  teamId,
}: GetOrganisationTemplateByIdOptions) => {
  const [callerTeam, { teamRole }] = await Promise.all([
    getTeamById({ teamId, userId }),
    getMemberRoles({
      teamId,
      reference: {
        type: 'User',
        id: userId,
      },
    }),
  ]);

  const envelope = await prisma.envelope.findFirst({
    where: {
      ...unsafeBuildEnvelopeIdQuery(id, EnvelopeType.TEMPLATE),
      templateType: TemplateType.ORGANISATION,
      visibility: {
        in: TEAM_DOCUMENT_VISIBILITY_MAP[teamRole],
      },
      team: {
        organisationId: callerTeam.organisationId,
      },
    },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
      folder: true,
      documentMeta: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recipients: {
        orderBy: {
          id: 'asc',
        },
      },
      fields: true,
      team: {
        select: {
          id: true,
          url: true,
        },
      },
      directLink: {
        select: {
          directTemplateRecipientId: true,
          enabled: true,
          id: true,
          token: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation template not found',
    });
  }

  return {
    ...envelope,
    user: {
      id: envelope.user.id,
      name: envelope.user.name || '',
      email: envelope.user.email,
    },
  };
};

/**
 * Build a where input for querying an organisation template.
 *
 * Matches a TEMPLATE envelope with templateType ORGANISATION belonging to any team
 * within the provided organisation, respecting the caller's team role visibility.
 */
export const getOrganisationTemplateWhereInput = ({
  id,
  organisationId,
  teamRole,
}: {
  id: EnvelopeIdOptions;
  organisationId: string;
  teamRole: TeamMemberRole;
}): Prisma.EnvelopeWhereInput => {
  return {
    ...unsafeBuildEnvelopeIdQuery(id, EnvelopeType.TEMPLATE),
    type: EnvelopeType.TEMPLATE,
    templateType: TemplateType.ORGANISATION,
    visibility: {
      in: TEAM_DOCUMENT_VISIBILITY_MAP[teamRole],
    },
    team: {
      organisationId,
    },
  };
};
