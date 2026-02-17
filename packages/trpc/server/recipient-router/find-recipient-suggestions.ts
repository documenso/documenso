import { z } from 'zod';

import { getRecipientSuggestions } from '@documenso/lib/server-only/recipient/get-recipient-suggestions';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetRecipientSuggestionsRequestSchema,
  ZGetRecipientSuggestionsResponseSchema,
} from './find-recipient-suggestions.types';

/**
 * @private
 */
export const findRecipientSuggestionsRoute = authenticatedProcedure
  .input(ZGetRecipientSuggestionsRequestSchema)
  .output(ZGetRecipientSuggestionsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { query } = input;

    ctx.logger.info({
      input: {
        query,
      },
    });

    const suggestions = await getRecipientSuggestions({
      userId: user.id,
      teamId,
      query,
    });

    const validSuggestions = suggestions.filter((item) => {
      return z.string().email().safeParse(item.email).success;
    });

    return {
      results: validSuggestions,
    };
  });
