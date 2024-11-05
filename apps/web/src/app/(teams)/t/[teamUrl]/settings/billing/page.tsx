import { Plural, Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';
import type Stripe from 'stripe';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { stripe } from '@documenso/lib/server-only/stripe';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { TeamBillingInvoicesDataTable } from '~/components/(teams)/tables/team-billing-invoices-data-table';
import { TeamBillingPortalButton } from '~/components/(teams)/team-billing-portal-button';

export type TeamsSettingsBillingPageProps = {
  params: {
    teamUrl: string;
  };
};

export default async function TeamsSettingBillingPage({ params }: TeamsSettingsBillingPageProps) {
  await setupI18nSSR();

  const { _ } = useLingui();

  const session = await getRequiredServerComponentSession();

  const team = await getTeamByUrl({ userId: session.user.id, teamUrl: params.teamUrl });

  const canManageBilling = canExecuteTeamAction('MANAGE_BILLING', team.currentTeamMember.role);

  let teamSubscription: Stripe.Subscription | null = null;

  if (team.subscription) {
    teamSubscription = await stripe.subscriptions.retrieve(team.subscription.planId);
  }

  const formatTeamSubscriptionDetails = (subscription: Stripe.Subscription | null) => {
    if (!subscription) {
      return <Trans>No payment required</Trans>;
    }

    const numberOfSeats = subscription.items.data[0].quantity ?? 0;

    const formattedTeamMemberQuanity = (
      <Plural value={numberOfSeats} one="# member" other="# members" />
    );

    const formattedDate = DateTime.fromSeconds(subscription.current_period_end).toFormat(
      'LLL dd, yyyy',
    );

    return _(msg`${formattedTeamMemberQuanity} • Monthly • Renews: ${formattedDate}`);
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
              <Trans>Current plan: {teamSubscription ? 'Team' : 'Early Adopter Team'}</Trans>
            </p>

            <p className="text-muted-foreground mt-0.5">
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
        <TeamBillingInvoicesDataTable teamId={team.id} />
      </section>
    </div>
  );
}
