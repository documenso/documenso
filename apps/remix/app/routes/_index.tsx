import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';

import type { Route } from './+types/_index';

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  if (user) {
    return redirect('/documents');
  }

  return redirect('/signin');
}
