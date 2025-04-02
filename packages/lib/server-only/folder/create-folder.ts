import { TeamMemberRole } from '@prisma/client';
import type { Team, TeamGlobalSettings } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { determineDocumentVisibility } from '../../utils/document-visibility';

export interface CreateFolderOptions {
  userId: number;
  teamId?: number;
  name: string;
  parentId?: string | null;
}

export const createFolder = async ({
  userId,
  teamId,
  name,
  parentId = null,
}: CreateFolderOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      teamMembers: {
        select: {
          teamId: true,
        },
      },
    },
  });

  if (
    teamId !== undefined &&
    !user.teamMembers.some((teamMember) => teamMember.teamId === teamId)
  ) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  let team: (Team & { teamGlobalSettings: TeamGlobalSettings | null }) | null = null;
  let userTeamRole: TeamMemberRole | undefined;

  if (teamId) {
    const teamWithUserRole = await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
      },
      include: {
        teamGlobalSettings: true,
        members: {
          where: {
            userId: userId,
          },
          select: {
            role: true,
          },
        },
      },
    });

    team = teamWithUserRole;
    userTeamRole = teamWithUserRole.members[0]?.role;
  }

  return await prisma.folder.create({
    data: {
      name,
      userId,
      teamId,
      parentId,
      visibility: determineDocumentVisibility(
        team?.teamGlobalSettings?.documentVisibility,
        userTeamRole ?? TeamMemberRole.MEMBER,
      ),
    },
  });
};
