import { getFieldById } from '@documenso/lib/server-only/field/get-field-by-id';

import { authenticatedProcedure } from '../../trpc';
import { twoFactorScope } from '../../two-factor-enforcement/enforce';
import {
  getEnvelopeFieldMeta,
  ZGetEnvelopeFieldRequestSchema,
  ZGetEnvelopeFieldResponseSchema,
} from './get-envelope-field.types';

export const getEnvelopeFieldRoute = authenticatedProcedure
  .meta(getEnvelopeFieldMeta)
  .input(ZGetEnvelopeFieldRequestSchema)
  .output(ZGetEnvelopeFieldResponseSchema)
  .use(twoFactorScope((input) => ({ field: input.fieldId })))
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { fieldId } = input;

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    return await getFieldById({
      userId: user.id,
      teamId,
      fieldId,
    });
  });
