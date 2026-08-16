import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { redirect } from 'react-router';

import type { Route } from './+types/_index';

export function loader({ params }: Route.LoaderArgs) {
  throw redirect(formatDocumentsPath(params.teamUrl));
}
