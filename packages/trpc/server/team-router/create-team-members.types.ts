import { z } from 'zod';

import { TeamMemberRole } from '@documenso/prisma/generated/types';

export const ZCreateTeamMembersRequestSchema = z.object({
  teamId: z.number(),
  organisationMembers: z
    .array(
      z.object({
        organisationMemberId: z.string().min(1),
        teamRole: z.nativeEnum(TeamMemberRole).describe('The team role to add the user as'),
      }),
    )
    .min(1)
    .superRefine((items, ctx) => {
      const seen = new Map<string, number>();

      items.forEach((item, index) => {
        const id = item.organisationMemberId;
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'IDs must be unique',
            path: [index, 'organisationMemberId'], // relative to organisationMembers
          });
        } else {
          seen.set(id, index);
        }
      });
    }),
});

export const ZCreateTeamMembersResponseSchema = z.void();

export type TCreateTeamMembersRequestSchema = z.infer<typeof ZCreateTeamMembersRequestSchema>;
