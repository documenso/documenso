import { executeTspSign } from '@documenso/ee/server-only/signing/csc/execute-tsp-sign';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import { procedure } from '../trpc';
import { ZCscSignEnvelopeRequestSchema, ZCscSignEnvelopeResponseSchema } from './csc-sign-envelope.types';

/**
 * Internal mutation that drives the CSC TSP sign-time pipeline.
 *
 * `executeTspSign` does the heavy lifting (capture → batched signHash →
 * embed → tx). This route wraps it in a 15s `Promise.race` so an unresponsive
 * TSP surfaces as `CSC_TSP_TIMEOUT` instead of hanging the request. The
 * idle-timer is a soft cap on TSP round-trip latency; the underlying tx
 * keeps running on the server until it completes or errors.
 */

const SIGN_TIMEOUT_MS = 15_000;

export const cscSignEnvelopeRoute = procedure
  .input(ZCscSignEnvelopeRequestSchema)
  .output(ZCscSignEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const result = await Promise.race([
      executeTspSign({
        sessionId: input.sessionId,
        recipientToken: input.recipientToken,
        requestMetadata: ctx.metadata.requestMetadata,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new AppError(AppErrorCode.CSC_TSP_TIMEOUT, {
                message: 'CSC TSP did not respond within 15s.',
              }),
            ),
          SIGN_TIMEOUT_MS,
        ),
      ),
    ]);

    return result;
  });
