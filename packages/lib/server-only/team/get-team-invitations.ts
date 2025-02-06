import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamMemberInviteSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamMemberInviteSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';

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
