import { TRPCClientError } from '@trpc/client';

import type { AppRouter } from '../server/router';

export const isTRPCBadRequestError = (err: unknown): err is TRPCClientError<AppRouter> => {
  return err instanceof TRPCClientError && err.shape?.code === 'BAD_REQUEST';
};
