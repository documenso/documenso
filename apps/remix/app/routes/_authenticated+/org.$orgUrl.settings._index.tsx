import { redirect } from 'react-router';

import type { Route } from './+types/_layout';

export function loader({ params }: Route.LoaderArgs) {
  if (params.orgUrl) {
    throw redirect(`/org/${params.orgUrl}/settings/general`);
  }

  throw redirect('/');
}
