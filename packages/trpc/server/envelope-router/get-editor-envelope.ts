import { getEditorEnvelopeById } from '@documenso/lib/server-only/envelope/get-editor-envelope-by-id';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import { ZGetEditorEnvelopeRequestSchema, ZGetEditorEnvelopeResponseSchema } from './get-editor-envelope.types';

export const getEditorEnvelopeRoute = authenticatedProcedure
  .input(ZGetEditorEnvelopeRequestSchema)
  .output(ZGetEditorEnvelopeResponseSchema)
  .use(twoFactorScope((input) => ({ envelope: input.envelopeId })))
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    return await getEditorEnvelopeById({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
    });
  });
