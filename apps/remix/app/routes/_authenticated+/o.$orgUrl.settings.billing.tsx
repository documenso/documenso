import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useSearchParams } from 'react-router';
import type Stripe from 'stripe';
import { match } from 'ts-pattern';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';

import { BillingPlans } from '~/components/general/billing-plans';
import { OrganisationBillingPortalButton } from '~/components/general/organisations/organisation-billing-portal-button';
import { OrganisationBillingInvoicesTable } from '~/components/tables/organisation-billing-invoices-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Billing');
}

export default function TeamsSettingBillingPage() {
  const { _, i18n } = useLingui();
  const [searchParams] = useSearchParams();

  const organisation = useCurrentOrganisation();

  const selectedPlan = searchParams.get('plan');
  const selectedCycle = searchParams.get('cycle') as 'monthly' | 'yearly' | null;
  const source = searchParams.get('source');

  const { data: subscriptionQuery, isLoading: isLoadingSubscription } =
    trpc.billing.subscription.get.useQuery({
      organisationId: organisation.id,
    });

  if (isLoadingSubscription || !subscriptionQuery) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  const { subscription, plans } = subscriptionQuery;

  const canManageBilling = canExecuteOrganisationAction(
    'MANAGE_BILLING',
    organisation.currentOrganisationRole,
  );

  const { organisationSubscription, stripeSubscription } = subscription || {};

  const currentProductName =
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (stripeSubscription?.items.data[0].price.product as Stripe.Product | undefined)?.name;

  const isFromPricingPage = source === 'pricing';

  return (
    <div>
      {isFromPricingPage && selectedPlan && !subscription && (
        <div className="bg-muted mb-4 rounded-lg p-4">
          <p className="text-sm">
            <Trans>
              Select a plan below to upgrade <strong>{organisation.name}</strong> to the{' '}
              {selectedPlan} plan
            </Trans>
          </p>
        </div>
      )}

      <div className="flex flex-row items-end justify-between">
        <div>
          <h3 className="text-2xl font-semibold">
            <Trans>Billing</Trans>
          </h3>

          <div className="text-muted-foreground mt-2 text-sm">
            {!organisationSubscription && (
              <p>
                <Trans>
                  You are currently on the <span className="font-semibold">Free Plan</span>.
                </Trans>
              </p>
            )}

            {organisationSubscription &&
              match(organisationSubscription.status)
                .with('ACTIVE', () => (
                  <p>
                    {currentProductName ? (
                      <span>
                        You are currently subscribed to{' '}
                        <span className="font-semibold">{currentProductName}</span>
                      </span>
                    ) : (
                      <span>You currently have an active plan</span>
                    )}

                    {organisationSubscription.periodEnd && (
                      <span>
                        {' '}
                        which is set to{' '}
                        {organisationSubscription.cancelAtPeriodEnd ? (
                          <span>
                            end on{' '}
                            <span className="font-semibold">
                              {i18n.date(organisationSubscription.periodEnd)}.
                            </span>
                          </span>
                        ) : (
                          <span>
                            automatically renew on{' '}
                            <span className="font-semibold">
                              {i18n.date(organisationSubscription.periodEnd)}.
                            </span>
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                ))
                .with('INACTIVE', () => (
                  <p>
                    {currentProductName ? (
                      <Trans>
                        You currently have an inactive{' '}
                        <span className="font-semibold">{currentProductName}</span> subscription
                      </Trans>
                    ) : (
                      <Trans>Your current plan is inactive.</Trans>
                    )}
                  </p>
                ))
                .with('PAST_DUE', () => (
                  <p>
                    {currentProductName ? (
                      <Trans>
                        Your current {currentProductName} plan is past due. Please update your
                        payment information.
                      </Trans>
                    ) : (
                      <Trans>Your current plan is past due.</Trans>
                    )}
                  </p>
                ))
                .otherwise(() => null)}
          </div>
        </div>

        <OrganisationBillingPortalButton />
      </div>

      <hr className="my-4" />

      {!subscription && canManageBilling && (
        <BillingPlans
          plans={plans}
          selectedPlan={selectedPlan}
          selectedCycle={selectedCycle}
          isFromPricingPage={source === 'pricing'}
        />
      )}

      <section className="mt-6">
        <OrganisationBillingInvoicesTable
          organisationId={organisation.id}
          subscriptionExists={Boolean(subscription)}
        />
      </section>
    </div>
  );
}
