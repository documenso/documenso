import { z } from 'zod';

export const ZGetPotentialDomainUsersRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to check potential users for'),
  limit: z.number().min(1).max(100).default(50).optional(),
});

export const ZGetPotentialDomainUsersResponseSchema = z.object({
  users: z.array(
    z.object({
      id: z.number(),
      email: z.string(),
      name: z.string().nullable(),
    }),
  ),
  totalCount: z.number(),
});

export type TGetPotentialDomainUsersRequestSchema = z.infer<
  typeof ZGetPotentialDomainUsersRequestSchema
>;

export type TGetPotentialDomainUsersResponseSchema = z.infer<
  typeof ZGetPotentialDomainUsersResponseSchema
>;
