import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamMemberSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamMemberSchema';
import { UserSchema } from '@documenso/prisma/generated/zod/modelSchema/UserSchema';

export type GetTeamMembersOptions = {
  userId: number;
  teamId: number;
};

export const ZGetTeamMembersResponseSchema = TeamMemberSchema.extend({
  user: UserSchema.pick({
    id: true,
    name: true,
    email: true,
  }),
}).array();

export type TGetTeamMembersResponseSchema = z.infer<typeof ZGetTeamMembersResponseSchema>;

/**
 * Get all team members for a given team.
 */
export const getTeamMembers = async ({
  userId,
  teamId,
}: GetTeamMembersOptions): Promise<TGetTeamMembersResponseSchema> => {
  return await prisma.teamMember.findMany({
    where: {
      team: {
        id: teamId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
};
