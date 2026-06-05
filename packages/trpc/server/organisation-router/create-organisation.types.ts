import { msg } from '@lingui/core/macro';
import { z } from 'zod';

// export const createOrganisationMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation',
//     summary: 'Create organisation',
//     description: 'Create an organisation',
//     tags: ['Organisation'],
//   },
// };

export const ZOrganisationNameSchema = z
  .string()
  .min(3, { message: msg`Must be at least 3 characters in length`.id })
  .max(50, { message: msg`Cannot be more than 50 characters in length`.id });

export const ZCreateOrganisationRequestSchema = z.object({
  name: ZOrganisationNameSchema,
  priceId: z.string().optional(),
});

export const ZCreateOrganisationResponseSchema = z.union([
  z.object({
    paymentRequired: z.literal(false),
  }),
  z.object({
    paymentRequired: z.literal(true),
    checkoutUrl: z.string(),
  }),
]);

export type TCreateOrganisationResponse = z.infer<typeof ZCreateOrganisationResponseSchema>;
