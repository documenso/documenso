import { redirect } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { getOrganisations } from '@documenso/trpc/server/organisation-router/get-organisations';

import type { Route } from './+types/billing-redirect';

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);
  if (!session.isAuthenticated) {
    const currentUrl = new URL(request.url);
    const redirectParam = encodeURIComponent(currentUrl.pathname + currentUrl.search);
    throw redirect(`/signin?redirect=${redirectParam}`);
  }

  const url = new URL(request.url);
  const plan = url.searchParams.get('plan');
  const cycle = url.searchParams.get('cycle');
  const source = url.searchParams.get('source');

  const queryParams = new URLSearchParams();
  if (plan) {
    queryParams.set('plan', plan);
  }
  if (cycle) {
    queryParams.set('cycle', cycle);
  }
  if (source) {
    queryParams.set('source', source);
  }
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const organisations = await getOrganisations({ userId: session.user.id });
  if (isPersonalLayout(organisations)) {
    return redirect(`/settings/billing${queryString}`);
  }

  const personalOrg = organisations.find((org) => org.type === 'PERSONAL') || organisations[0];
  if (personalOrg) {
    return redirect(`/o/${personalOrg.url}/settings/billing${queryString}`);
  }

  return redirect('/settings/profile');
}

export default function BillingRedirect() {
  return null;
}
