import { redirect } from 'react-router';

import { formatDocumentsPath } from '@doku-seal/lib/utils/teams';

import type { Route } from './+types/_index';

export function loader({ params }: Route.LoaderArgs) {
  throw redirect(formatDocumentsPath(params.teamUrl));
}
