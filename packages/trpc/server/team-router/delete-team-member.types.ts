import { z } from 'zod';

// export const deleteTeamMemberMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/team/member/delete',
//     summary: 'Delete team member',
//     description: 'Delete team member',
//     tags: ['Team'],
//   },
// };

export const ZDeleteTeamMemberRequestSchema = z.object({
  teamId: z.number().describe('The ID of the team to remove the member from.'),
  memberId: z.string().describe('The ID of the member to remove from the team.'),
});

export const ZDeleteTeamMemberResponseSchema = z.void();
