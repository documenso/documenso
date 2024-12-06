import { z } from 'zod';

export const ZFindResultSet = z.object({
  data: z.union([z.array(z.unknown()), z.unknown()]),
  count: z.number(),
  currentPage: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
});

// Can't infer generics from Zod.
export type FindResultSet<T> = {
  data: T extends Array<unknown> ? T : T[];
  count: number;
  currentPage: number;
  perPage: number;
  totalPages: number;
};
