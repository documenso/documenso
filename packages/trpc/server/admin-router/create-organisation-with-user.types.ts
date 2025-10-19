import { z } from 'zod';

import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';

import { ZOrganisationNameSchema } from '../organisation-router/create-organisation.types';

export const ZCreateOrganisationWithUserRequestSchema = z.object({
  data: z.object({
    organisationName: ZOrganisationNameSchema,
    userEmail: z.string().email().min(1),
    userName: z.string().min(1),
    subscriptionClaimId: z.nativeEnum(INTERNAL_CLAIM_ID),
  }),
});

export type TCreateOrganisationWithUserRequest = z.infer<
  typeof ZCreateOrganisationWithUserRequestSchema
>;

export const ZCreateOrganisationWithUserResponseSchema = z.object({
  organisationId: z.string(),
  userId: z.number(),
  isNewUser: z.boolean(),
});

export type TCreateOrganisationWithUserResponse = z.infer<
  typeof ZCreateOrganisationWithUserResponseSchema
>;
