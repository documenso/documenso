import { redirect } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';

import type { Route } from './+types/_index';

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  if (isAuthenticated) {
    throw redirect('/documents');
  }

  throw redirect('/signin');
}
