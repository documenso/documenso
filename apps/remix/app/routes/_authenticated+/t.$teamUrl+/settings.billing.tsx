import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import type Stripe from 'stripe';
import { match } from 'ts-pattern';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { stripe } from '@documenso/lib/server-only/stripe';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { SettingsHeader } from '~/components/general/settings-header';
import { TeamBillingPortalButton } from '~/components/general/teams/team-billing-portal-button';
import { TeamSettingsBillingInvoicesTable } from '~/components/tables/team-settings-billing-invoices-table';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/settings.billing';

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request);

  const team = await getTeamByUrl({
    userId: session.user.id,
    teamUrl: params.teamUrl,
  });

  let teamSubscription: Stripe.Subscription | null = null;

  if (team.subscription) {
    teamSubscription = await stripe.subscriptions.retrieve(team.subscription.planId);
  }

  return superLoaderJson({
    team,
    teamSubscription,
  });
}

export default function TeamsSettingBillingPage() {
  const { _ } = useLingui();

  const { team, teamSubscription } = useSuperLoaderData<typeof loader>();

  const canManageBilling = canExecuteTeamAction('MANAGE_BILLING', team.currentTeamMember.role);

  const formatTeamSubscriptionDetails = (subscription: Stripe.Subscription | null) => {
    if (!subscription) {
      return <Trans>No payment required</Trans>;
    }

    const numberOfSeats = subscription.items.data[0].quantity ?? 0;

    const formattedDate = DateTime.fromSeconds(subscription.current_period_end).toFormat(
      'LLL dd, yyyy',
    );

    const subscriptionInterval = match(subscription?.items.data[0].plan.interval)
      .with('year', () => _(msg`Yearly`))
      .with('month', () => _(msg`Monthly`))
      .otherwise(() => _(msg`Unknown`));

    return (
      <span>
        <Plural value={numberOfSeats} one="# member" other="# members" />
        {' • '}
        <span>{subscriptionInterval}</span>
        {' • '}
        <Trans>Renews: {formattedDate}</Trans>
      </span>
    );
  };

  return (
    <div>
      <SettingsHeader
        title={_(msg`Billing`)}
        subtitle={_(msg`Your subscription is currently active.`)}
      />

      <Card gradient className="shadow-sm">
        <CardContent className="flex flex-row items-center justify-between p-4">
          <div className="flex flex-col text-sm">
            <p className="text-foreground font-semibold">
              {formatTeamSubscriptionDetails(teamSubscription)}
            </p>
          </div>

          {teamSubscription && (
            <div
              title={
                canManageBilling
                  ? _(msg`Manage team subscription.`)
                  : _(msg`You must be an admin of this team to manage billing.`)
              }
            >
              <TeamBillingPortalButton teamId={team.id} />
            </div>
          )}
        </CardContent>
      </Card>

      <section className="mt-6">
        <TeamSettingsBillingInvoicesTable teamId={team.id} />
      </section>
    </div>
  );
}
