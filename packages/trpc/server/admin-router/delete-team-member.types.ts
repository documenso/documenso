import { z } from 'zod';

export const ZDeleteAdminTeamMemberRequestSchema = z.object({
  teamId: z.number().min(1),
  memberId: z.string().min(1),
});

export const ZDeleteAdminTeamMemberResponseSchema = z.void();

export type TDeleteAdminTeamMemberRequest = z.infer<typeof ZDeleteAdminTeamMemberRequestSchema>;
export type TDeleteAdminTeamMemberResponse = z.infer<typeof ZDeleteAdminTeamMemberResponseSchema>;
