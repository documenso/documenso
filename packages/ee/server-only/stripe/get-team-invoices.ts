import { stripe } from '@documenso/lib/server-only/stripe';

export type GetTeamInvoicesOptions = {
  teamId: number;
};

export const getTeamInvoices = async ({ teamId }: GetTeamInvoicesOptions) => {
  const teamSubscriptions = await stripe.subscriptions.search({
    limit: 100,
    query: `metadata["teamId"]:"${teamId}"`,
  });

  const subscriptionIds = teamSubscriptions.data.map((subscription) => subscription.id);

  if (subscriptionIds.length === 0) {
    return null;
  }

  return await stripe.invoices.search({
    query: subscriptionIds.map((id) => `subscription:"${id}"`).join(' OR '),
    limit: 100,
  });
};
