import { redirect } from 'react-router';

import type { Route } from './+types/_index';

export function loader({ context }: Route.LoaderArgs) {
  if (context.session) {
    throw redirect('/documents');
  }

  throw redirect('/signin');
}
