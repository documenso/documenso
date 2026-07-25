import { redirect } from 'react-router';

import type { Route } from './+types/settings._index';

export function loader({ params }: Route.LoaderArgs) {
  if (params.teamUrl) {
    throw redirect(`/t/${params.teamUrl}/settings/general`);
  }

  throw redirect('/');
}
