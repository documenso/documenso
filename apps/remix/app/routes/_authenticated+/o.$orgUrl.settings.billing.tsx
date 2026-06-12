import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { SubscriptionStatus } from '@prisma/client';
import { Loader } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import type Stripe from 'stripe';
import { match, P } from 'ts-pattern';

import { BillingPlans } from '~/components/general/billing-plans';
import { OrganisationBillingPortalButton } from '~/components/general/organisations/organisation-billing-portal-button';
import { OrganisationBillingInvoicesTable } from '~/components/tables/organisation-billing-invoices-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Billing`);
}

export default function TeamsSettingBillingPage() {
  const { _, i18n } = useLingui();

  const organisation = useCurrentOrganisation();

  const [searchParams, setSearchParams] = useSearchParams();
  const utils = trpc.useUtils();

  const { data: subscriptionQuery, isLoading: isLoadingSubscription } =
    trpc.enterprise.billing.subscription.get.useQuery({
      organisationId: organisation.id,
    });

  const { mutateAsync: syncSubscription, isPending: isSyncingSubscription } =
    trpc.enterprise.billing.subscription.sync.useMutation();

  const hasTriggeredCheckoutSyncRef = useRef(false);

  const isCheckoutSuccess = searchParams.get('success') === 'true';

  /**
   * Eagerly sync the subscription from Stripe when returning from a successful
   * checkout, since the webhook may not have arrived yet.
   */
  useEffect(() => {
    if (!isCheckoutSuccess || hasTriggeredCheckoutSyncRef.current) {
      return;
    }

    hasTriggeredCheckoutSyncRef.current = true;

    void syncSubscription({ organisationId: organisation.id })
      .catch(() => {
        // Non-fatal, webhooks will converge the subscription state shortly.
      })
      .finally(() => {
        void utils.enterprise.billing.invalidate();

        setSearchParams(
          (params) => {
            params.delete('success');

            return params;
          },
          { replace: true },
        );
      });
  }, [isCheckoutSuccess, organisation.id]);

  if (isLoadingSubscription || !subscriptionQuery || isSyncingSubscription) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { subscription, plans } = subscriptionQuery;

  const canManageBilling = canExecuteOrganisationAction('MANAGE_BILLING', organisation.currentOrganisationRole);

  const { organisationSubscription, stripeSubscription } = subscription || {};

  const currentProductName =
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (stripeSubscription?.items.data[0].price.product as Stripe.Product | undefined)?.name;

  return (
    <div>
      <div className="flex flex-row items-end justify-between">
        <div>
          <h3 className="font-semibold text-2xl">
            <Trans>Billing</Trans>
          </h3>

          <div className="mt-2 text-muted-foreground text-sm">
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
                    {match(organisationSubscription)
                      .with({ cancelAtPeriodEnd: true, periodEnd: P.nonNullable }, ({ periodEnd }) =>
                        currentProductName ? (
                          <Trans>
                            You are currently subscribed to <span className="font-semibold">{currentProductName}</span>{' '}
                            which is set to end on <span className="font-semibold">{i18n.date(periodEnd)}</span>.
                          </Trans>
                        ) : (
                          <Trans>
                            You currently have an active plan which is set to end on{' '}
                            <span className="font-semibold">{i18n.date(periodEnd)}</span>.
                          </Trans>
                        ),
                      )
                      .with({ cancelAtPeriodEnd: false, periodEnd: P.nonNullable }, ({ periodEnd }) =>
                        currentProductName ? (
                          <Trans>
                            You are currently subscribed to <span className="font-semibold">{currentProductName}</span>{' '}
                            which is set to automatically renew on{' '}
                            <span className="font-semibold">{i18n.date(periodEnd)}</span>.
                          </Trans>
                        ) : (
                          <Trans>
                            You currently have an active plan which is set to automatically renew on{' '}
                            <span className="font-semibold">{i18n.date(periodEnd)}</span>.
                          </Trans>
                        ),
                      )
                      .otherwise(() =>
                        currentProductName ? (
                          <Trans>
                            You are currently subscribed to <span className="font-semibold">{currentProductName}</span>.
                          </Trans>
                        ) : (
                          <Trans>You currently have an active plan.</Trans>
                        ),
                      )}
                  </p>
                ))
                .with('INACTIVE', () => (
                  <p>
                    {currentProductName ? (
                      <Trans>
                        You currently have an inactive <span className="font-semibold">{currentProductName}</span>{' '}
                        subscription.
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
                        Your current {currentProductName} plan is past due. Please update your payment information.
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

      {(!subscription || subscription.organisationSubscription.status === SubscriptionStatus.INACTIVE) &&
        canManageBilling && <BillingPlans plans={plans} />}

      <section className="mt-6">
        <OrganisationBillingInvoicesTable organisationId={organisation.id} subscriptionExists={Boolean(subscription)} />
      </section>
    </div>
  );
}
