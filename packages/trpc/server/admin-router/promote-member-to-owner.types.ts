import { z } from 'zod';

export const ZPromoteMemberToOwnerRequestSchema = z.object({
  organisationId: z.string().min(1),
  userId: z.number().min(1),
});

export const ZPromoteMemberToOwnerResponseSchema = z.void();

export type TPromoteMemberToOwnerRequest = z.infer<typeof ZPromoteMemberToOwnerRequestSchema>;
export type TPromoteMemberToOwnerResponse = z.infer<typeof ZPromoteMemberToOwnerResponseSchema>;
