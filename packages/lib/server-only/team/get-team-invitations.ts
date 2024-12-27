import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamMemberInviteSchema, TeamSchema } from '@documenso/prisma/generated/zod';

export type GetTeamInvitationsOptions = {
  email: string;
};

export const ZGetTeamInvitationsResponseSchema = TeamMemberInviteSchema.extend({
  team: TeamSchema.pick({
    id: true,
    name: true,
    url: true,
    avatarImageId: true,
  }),
}).array();

export type TGetTeamInvitationsResponse = z.infer<typeof ZGetTeamInvitationsResponseSchema>;

export const getTeamInvitations = async ({
  email,
}: GetTeamInvitationsOptions): Promise<TGetTeamInvitationsResponse> => {
  return await prisma.teamMemberInvite.findMany({
    where: {
      email,
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          url: true,
          avatarImageId: true,
        },
      },
    },
  });
};
