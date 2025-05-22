import { TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';

// export const getTeamsMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'GET',
//     path: '/team/teams',
//     summary: 'Get teams',
//     description: 'Get all teams you are a member of',
//     tags: ['team'],
//   },
// };

export const ZFindTeamsRequestSchema = ZFindSearchParamsSchema.extend({
  organisationId: z.string(),
});

export const ZFindTeamsResponseSchema = ZFindResultResponse.extend({
  data: TeamSchema.pick({
    id: true,
    name: true,
    url: true,
    createdAt: true,
    avatarImageId: true,
    organisationId: true,
  })
    .extend({
      currentTeamRole: z.nativeEnum(TeamMemberRole),
    })
    .array(),
});

export type TFindTeamsResponse = z.infer<typeof ZFindTeamsResponseSchema>;
