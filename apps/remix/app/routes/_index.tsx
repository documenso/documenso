import { redirect } from 'react-router';

import type { Route } from './+types/_index';

export async function loader({ context }: Route.LoaderArgs) {
  if (context.session) {
    return redirect('/documents');
  }

  return redirect('/signin');
}
