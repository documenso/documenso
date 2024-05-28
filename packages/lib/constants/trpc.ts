/**
 * For TRPC useQueries that should not be batched with other queries.
 */
export const SKIP_QUERY_BATCH_META = {
  trpc: {
    context: {
      skipBatch: true,
    },
  },
};

/**
 * For TRPC useQueries and useMutations to adjust the logic on when query invalidation
 * should occur.
 *
 * When used in:
 * - useQuery: Will not invalidate the given query when a mutation occurs.
 * - useMutation: Will not trigger invalidation on all queries when mutation succeeds.
 *
 */
export const DO_NOT_INVALIDATE_QUERY_ON_MUTATION = {
  meta: {
    doNotInvalidateQueryOnMutation: true,
  },
};
