import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2Icon, PlusIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';

import type { InternalClaimPlans } from '@documenso/ee/server-only/stripe/get-internal-claim-plans';
import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent, CardTitle } from '@documenso/ui/primitives/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { ZCreateOrganisationFormSchema } from '../dialogs/organisation-create-dialog';

const MotionCard = motion.create(Card);

export type BillingPlansProps = {
  plans: InternalClaimPlans;
};

export const BillingPlans = ({ plans }: BillingPlansProps) => {
  const isMounted = useIsMounted();

  const { organisations } = useSession();

  const [interval, setInterval] = useState<'monthlyPrice' | 'yearlyPrice'>('yearlyPrice');

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const pricesToDisplay = useMemo(() => {
    const prices = [];

    for (const plan of Object.values(plans)) {
      if (plan[interval] && plan[interval].isVisibleInApp) {
        prices.push({
          ...plan[interval],
          memberCount: plan.memberCount,
          claim: plan.id,
        });
      }
    }

    return prices;
  }, [plans, interval]);

  return (
    <div>
      <Tabs
        value={interval}
        onValueChange={(value) => setInterval(value as 'monthlyPrice' | 'yearlyPrice')}
      >
        <TabsList>
          <TabsTrigger className="min-w-[150px]" value="monthlyPrice">
            <Trans>Monthly</Trans>
          </TabsTrigger>
          <TabsTrigger className="min-w-[150px]" value="yearlyPrice">
            <Trans>Yearly</Trans>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-8 grid gap-8 lg:grid-cols-2 2xl:grid-cols-3">
        <AnimatePresence mode="wait">
          {pricesToDisplay.map((price) => (
            <MotionCard
              key={price.id}
              initial={{ opacity: isMounted ? 0 : 1, y: isMounted ? 20 : 0 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
            >
              <CardContent className="flex h-full flex-col p-6">
                <CardTitle>{price.product.name}</CardTitle>

                <div className="mt-2 text-lg font-medium text-muted-foreground">
                  {price.friendlyPrice + ' '}
                  <span className="text-xs">
                    {interval === 'monthlyPrice' ? (
                      <Trans>per month</Trans>
                    ) : (
                      <Trans>per year</Trans>
                    )}
                  </span>
                </div>

                <div className="mt-1.5 text-sm text-muted-foreground">
                  {price.product.description}
                </div>

                {price.product.features && price.product.features.length > 0 && (
                  <div className="mt-4 text-muted-foreground">
                    <div className="text-sm font-medium">Includes:</div>

                    <ul className="mt-1 divide-y text-sm">
                      {price.product.features.map((feature, index) => (
                        <li key={index} className="py-2">
                          {feature.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex-1" />

                {isPersonalLayoutMode && price.claim === INTERNAL_CLAIM_ID.INDIVIDUAL ? (
                  <IndividualPersonalLayoutCheckoutButton priceId={price.id}>
                    <Trans>Subscribe</Trans>
                  </IndividualPersonalLayoutCheckoutButton>
                ) : (
                  <BillingDialog
                    priceId={price.id}
                    planName={price.product.name}
                    memberCount={price.memberCount}
                    claim={price.claim}
                  />
                )}
              </CardContent>
            </MotionCard>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const BillingDialog = ({
  priceId,
  planName,
  claim,
}: {
  priceId: string;
  planName: string;
  memberCount: number;
  claim: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const [subscriptionOption, setSubscriptionOption] = useState<'update' | 'create'>(
    organisation.type === 'PERSONAL' && claim === INTERNAL_CLAIM_ID.INDIVIDUAL
      ? 'update'
      : 'create',
  );

  const [step, setStep] = useState(0);

  const form = useForm({
    resolver: zodResolver(ZCreateOrganisationFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const { mutateAsync: createSubscription, isPending: isCreatingSubscription } =
    trpc.enterprise.billing.subscription.create.useMutation();

  const { mutateAsync: createOrganisation, isPending: isCreatingOrganisation } =
    trpc.organisation.create.useMutation();

  const isPending = isCreatingSubscription || isCreatingOrganisation;

  const onSubscribeClick = async () => {
    try {
      let redirectUrl = '';

      if (subscriptionOption === 'update') {
        const createSubscriptionResponse = await createSubscription({
          organisationId: organisation.id,
          priceId,
        });

        redirectUrl = createSubscriptionResponse.redirectUrl;
      } else {
        const createOrganisationResponse = await createOrganisation({
          name: form.getValues('name'),
          priceId,
        });

        if (!createOrganisationResponse.paymentRequired) {
          setIsOpen(false);
          return;
        }

        redirectUrl = createOrganisationResponse.checkoutUrl;
      }

      window.location.href = redirectUrl;
    } catch (_err) {
      toast({
        title: t`Something went wrong`,
        description: t`An error occurred while trying to create a checkout session.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(value) => !isPending && setIsOpen(value)}>
      <DialogTrigger asChild>
        <Button>
          <Trans>Subscribe</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Subscribe</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>You are about to subscribe to the {planName}</Trans>
          </DialogDescription>
        </DialogHeader>

        {step === 0 ? (
          <div>
            <RadioGroup
              className="space-y-2"
              value={subscriptionOption}
              onValueChange={(value) => setSubscriptionOption(value as 'update' | 'create')}
            >
              <div className="flex items-start space-x-3 space-y-0">
                <RadioGroupItem value="update" id="update" />
                <div className="space-y-1.5 leading-none">
                  <Label htmlFor="update" className="flex items-center gap-2 font-medium">
                    <Building2Icon className="h-4 w-4" />
                    <Trans>Update current organisation</Trans>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    <Trans>
                      Upgrade <strong>{organisation.name}</strong> to {planName}
                    </Trans>
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 space-y-0">
                <RadioGroupItem value="create" id="create" />
                <div className="space-y-1.5 leading-none">
                  <Label htmlFor="create" className="flex items-center gap-2 font-medium">
                    <PlusIcon className="h-4 w-4" />
                    <Trans>Create separate organisation</Trans>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    <Trans>
                      Create a new organisation with {planName} plan. Keep your current organisation
                      on it's current plan
                    </Trans>
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        ) : (
          <Form {...form}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Organisation Name</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Form>
        )}

        <DialogFooter>
          <DialogClose>
            <Button disabled={isPending} variant="secondary">
              <Trans>Close</Trans>
            </Button>
          </DialogClose>

          {subscriptionOption === 'create' && step === 0 ? (
            <Button className="mt-4" loading={isPending} onClick={() => setStep(1)}>
              <Trans>Continue</Trans>
            </Button>
          ) : (
            <Button className="mt-4" loading={isPending} onClick={() => void onSubscribeClick()}>
              <Trans>Checkout</Trans>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Custom checkout button for individual organisations in personal layout mode.
 *
 * This is so they don't create an additional organisation which is not needed since
 * it will clutter up the UI for them with unnecessary organisations.
 */
export const IndividualPersonalLayoutCheckoutButton = ({
  priceId,
  children,
}: {
  priceId: string;
  children: React.ReactNode;
}) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { organisations } = useSession();

  const { mutateAsync: createSubscription, isPending } =
    trpc.enterprise.billing.subscription.create.useMutation();

  const onSubscribeClick = async () => {
    try {
      const createSubscriptionResponse = await createSubscription({
        organisationId: organisations[0].id,
        priceId,
        isPersonalLayoutMode: true,
      });

      window.location.href = createSubscriptionResponse.redirectUrl;
    } catch (_err) {
      toast({
        title: t`Something went wrong`,
        description: t`An error occurred while trying to create a checkout session.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Button loading={isPending} onClick={() => void onSubscribeClick()}>
      {children}
    </Button>
  );
};
