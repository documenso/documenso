import { redirect } from 'react-router';
import { getLoaderSession } from 'server/utils/get-loader-session';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';

export function loader() {
  const { currentTeam } = getLoaderSession();

  if (!currentTeam) {
    throw redirect('/settings/teams');
  }

  throw redirect(formatDocumentsPath(currentTeam.url));
}
