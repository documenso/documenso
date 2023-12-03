import { z } from 'zod';

export const ZSemSearchQuery = z.object({
  user_query: z.string(),
});

export type TSemSearchQuery = z.infer<typeof ZSemSearchQuery>;
