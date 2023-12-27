import { DateTime } from 'luxon';
import type Stripe from 'stripe';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { stripe } from '@documenso/lib/server-only/stripe';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-teams';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { BillingPortalButton } from '~/app/(dashboard)/settings/billing/billing-portal-button';
import SettingsHeader from '~/components/(dashboard)/settings/layout/header';
import TeamBillingInvoicesDataTable from '~/components/(teams)/tables/team-billing-invoices-data-table';

export type TeamsSettingsBillingPageProps = {
  params: {
    teamUrl: string;
  };
};

export default async function TeamsSettingBillingPage({ params }: TeamsSettingsBillingPageProps) {
  const { teamUrl } = params;

  const session = await getRequiredServerComponentSession();

  const team = await getTeamByUrl({ userId: session.user.id, teamUrl });

  const isUserOwnerOfTeam = team.ownerUserId === session.user.id;

  let teamSubscription: Stripe.Subscription | null = null;

  if (team.subscriptionId) {
    teamSubscription = await stripe.subscriptions.retrieve(team.subscriptionId);
  }

  const formatTeamSubscriptionDetails = (subscription: Stripe.Subscription | null) => {
    if (!subscription) {
      return 'No payment required';
    }

    const numberOfSeats = subscription.items.data[0].quantity ?? 0;

    const formattedTeamMemberQuanity = numberOfSeats > 1 ? `${numberOfSeats} members` : '1 member';

    const formattedDate = DateTime.fromSeconds(subscription.current_period_end).toFormat(
      'LLL dd, yyyy',
    );

    return `${formattedTeamMemberQuanity} • Monthly • Renews: ${formattedDate}`;
  };

  return (
    <div>
      <SettingsHeader title="Billing" subtitle="Your subscription is currently active." />

      <Card gradient className="shadow-sm">
        <CardContent className="flex flex-row items-center justify-between p-4">
          <div className="flex flex-col text-sm">
            <p className="text-foreground font-semibold">
              Current plan: {teamSubscription ? 'Team' : 'Community Team'}
            </p>

            <p className="text-muted-foreground mt-0.5">
              {formatTeamSubscriptionDetails(teamSubscription)}
            </p>
          </div>

          {teamSubscription && (
            <div
              title={
                isUserOwnerOfTeam
                  ? 'Manage your team subscription.'
                  : 'You must be the owner of this team to directly manage the billing.'
              }
            >
              <BillingPortalButton buttonProps={{ disabled: !isUserOwnerOfTeam }} />
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
