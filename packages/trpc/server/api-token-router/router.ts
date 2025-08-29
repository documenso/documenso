import { router } from '../trpc';
import { createApiTokenRoute } from './create-api-token';
import { deleteApiTokenRoute } from './delete-api-token';
import { getApiTokensRoute } from './get-api-tokens';

export const apiTokenRouter = router({
  create: createApiTokenRoute,
  getMany: getApiTokensRoute,
  delete: deleteApiTokenRoute,
});
