import { z } from 'zod';

/**
 * Required for empty responses since we currently can't 201 requests for our openapi setup.
 *
 * Without this it will throw an error in Speakeasy SDK when it tries to parse an empty response.
 */
export const ZSuccessResponseSchema = z.object({
  success: z.boolean(),
});

export const ZGenericSuccessResponse = {
  success: true,
} satisfies z.infer<typeof ZSuccessResponseSchema>;
