import { z } from 'zod';

/**
 * Backend only schema is used for find search params.
 *
 * Does not catch, because TRPC Open API won't allow catches as a type.
 *
 * Keep this and `ZUrlSearchParamsSchema` in sync.
 */
export const ZFindSearchParamsSchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().min(1).optional(),
  perPage: z.coerce.number().min(1).optional(),
});

/**
 * Frontend schema used to parse search params from URL.
 *
 * Keep this and `ZFindSearchParamsSchema` in sync.
 */
export const ZUrlSearchParamsSchema = z.object({
  query: z
    .string()
    .optional()
    .catch(() => undefined),
  page: z.coerce
    .number()
    .min(1)
    .optional()
    .catch(() => undefined),
  perPage: z.coerce
    .number()
    .min(1)
    .optional()
    .catch(() => undefined),
});

export const ZFindResultResponse = z.object({
  data: z.union([z.array(z.unknown()), z.unknown()]),
  count: z.number(),
  currentPage: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
});

// Can't infer generics from Zod.
export type FindResultResponse<T> = {
  data: T extends Array<unknown> ? T : T[];
  count: number;
  currentPage: number;
  perPage: number;
  totalPages: number;
};
