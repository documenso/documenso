import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { type MiddlewareFunction, redirect } from 'react-router';

/**
 * Gate for the `_authenticated+` route tree. Lives in middleware rather than the
 * layout loader so it also runs when single fetch requests a subset of loaders
 * via `?_routes=`.
 *
 * Embed sessions only exist to sign inside an iframe and are treated as signed
 * out here.
 */
export const authenticatedMiddleware: MiddlewareFunction = async ({ request }, next) => {
  const { session } = await getOptionalSession(request);

  if (!session || session.isEmbed) {
    throw redirect('/signin');
  }

  return next();
};
