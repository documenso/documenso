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
  .min(3, { message: 'Minimum 3 characters' })
  .max(50, { message: 'Maximum 50 characters' });

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
