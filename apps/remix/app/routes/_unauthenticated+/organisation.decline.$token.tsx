import { redirect } from 'react-router';

import type { Route } from './+types/organisation.decline.$token';

export function loader({ params }: Route.LoaderArgs) {
  const { token } = params;

  if (!token) {
    throw redirect('/');
  }

  // Declining now happens on the invite page via tRPC. Redirect there with the
  // `action=decline` flag so it renders the decline-only view (no accept).
  throw redirect(`/organisation/invite/${token}?action=decline`);
}
