import { z } from 'zod';

import { ZEmail } from '@documenso/lib/utils/zod';

export const ZGetRecipientSuggestionsRequestSchema = z.object({
  query: z.string().default(''),
});

export const ZGetRecipientSuggestionsResponseSchema = z.object({
  results: z.array(
    z.object({
      name: z.string().nullable(),
      email: z.union([ZEmail, z.literal('')]),
    }),
  ),
});

export type TGetRecipientSuggestionsRequestSchema = z.infer<
  typeof ZGetRecipientSuggestionsRequestSchema
>;

export type TGetRecipientSuggestionsResponseSchema = z.infer<
  typeof ZGetRecipientSuggestionsResponseSchema
>;
