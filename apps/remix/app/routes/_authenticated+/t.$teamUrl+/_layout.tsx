import { Outlet, replace } from 'react-router';

import { getRequiredSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';
import { TrpcProvider } from '@documenso/trpc/react';

import { TeamProvider } from '~/providers/team';

import type { Route } from './+types/_layout';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  // Todo: get user better from context or something
  // Todo: get user better from context or something
  const { user } = await getRequiredSession(request);

  const [getTeamsPromise, getTeamPromise] = await Promise.allSettled([
    getTeams({ userId: user.id }),
    getTeamByUrl({ userId: user.id, teamUrl: params.teamUrl }),
  ]);

  console.log('1');
  console.log({ userId: user.id, teamUrl: params.teamUrl });
  console.log(getTeamPromise.status);
  if (getTeamPromise.status === 'rejected') {
    console.log('2');
    return replace('/documents');
  }

  const team = getTeamPromise.value;
  const teams = getTeamsPromise.status === 'fulfilled' ? getTeamsPromise.value : [];

  const trpcHeaders = {
    'x-team-Id': team.id.toString(),
  };

  return {
    team,
    teams,
    trpcHeaders,
  };
};

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { team, trpcHeaders } = loaderData;

  return (
    <TeamProvider team={team}>
      <TrpcProvider headers={trpcHeaders}>
        {/* Todo: Do this. */}
        {/* {team.subscription && team.subscription.status !== SubscriptionStatus.ACTIVE && (
          <LayoutBillingBanner
            subscription={team.subscription}
            teamId={team.id}
            userRole={team.currentTeamMember.role}
          />
        )} */}

        <main className="mt-8 pb-8 md:mt-12 md:pb-12">
          <Outlet />
        </main>
      </TrpcProvider>
    </TeamProvider>
  );
}
