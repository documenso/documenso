import { redirect } from 'react-router';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';

import type { Route } from './+types/_index';

export function loader({ context }: Route.LoaderArgs) {
  if (!context.session?.currentTeam) {
    throw redirect('/documents');
  }

  throw redirect(formatDocumentsPath(context.session.currentTeam.url));
}
