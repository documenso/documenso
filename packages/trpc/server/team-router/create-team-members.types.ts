import { z } from 'zod';

import { TeamMemberRole } from '@documenso/prisma/generated/types';

export const ZCreateTeamMembersRequestSchema = z.object({
  teamId: z.number(),
  organisationMembers: z
    .array(
      z.object({
        organisationMemberId: z.string(),
        teamRole: z.nativeEnum(TeamMemberRole).describe('The team role to add the user as'),
      }),
    )
    .min(1)
    // Todo: orgs test
    .superRefine((items, ctx) => {
      const uniqueIds = new Map<string, number>();

      for (const [index, organisationMember] of items.entries()) {
        const email = organisationMember.organisationMemberId;

        const firstFoundIndex = uniqueIds.get(email);

        if (firstFoundIndex === undefined) {
          uniqueIds.set(email, index);
          continue;
        }

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'IDs must be unique',
          path: ['organisationMembers', index, 'organisationMemberId'],
        });
      }
    }),
});

export const ZCreateTeamMembersResponseSchema = z.void();

export type TCreateTeamMembersRequestSchema = z.infer<typeof ZCreateTeamMembersRequestSchema>;
