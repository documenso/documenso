import { z } from 'zod';

export const ZGetRecipientSuggestionsRequestSchema = z.object({
  query: z.string().default(''),
});

export const ZGetRecipientSuggestionsResponseSchema = z.object({
  results: z.array(
    z.object({
      name: z.string().nullable(),
      email: z.string().email(),
    }),
  ),
});

export type TGetRecipientSuggestionsRequestSchema = z.infer<
  typeof ZGetRecipientSuggestionsRequestSchema
>;

export type TGetRecipientSuggestionsResponseSchema = z.infer<
  typeof ZGetRecipientSuggestionsResponseSchema
>;
