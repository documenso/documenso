import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { ExternalLinkIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';
import type { z } from 'zod';

import type { InternalClaimPlans } from '@documenso/ee/server-only/stripe/get-internal-claim-plans';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { parseMessageDescriptorMacro } from '@documenso/lib/utils/i18n';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationRequestSchema } from '@documenso/trpc/server/organisation-router/create-organisation.types';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
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
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { IndividualPersonalLayoutCheckoutButton } from '../general/billing-plans';

export type OrganisationCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const ZCreateOrganisationFormSchema = ZCreateOrganisationRequestSchema.pick({
  name: true,
});

export type TCreateOrganisationFormSchema = z.infer<typeof ZCreateOrganisationFormSchema>;

export const OrganisationCreateDialog = ({ trigger, ...props }: OrganisationCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { refreshSession, organisations } = useSession();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const actionSearchParam = searchParams?.get('action');

  const [step, setStep] = useState<'billing' | 'create'>(
    IS_BILLING_ENABLED() ? 'billing' : 'create',
  );

  const [selectedPriceId, setSelectedPriceId] = useState<string>('');

  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(ZCreateOrganisationFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const { mutateAsync: createOrganisation } = trpc.organisation.create.useMutation();

  const { data: plansData } = trpc.enterprise.billing.plans.get.useQuery(undefined, {
    enabled: IS_BILLING_ENABLED(),
  });

  const onFormSubmit = async ({ name }: TCreateOrganisationFormSchema) => {
    try {
      const response = await createOrganisation({
        name,
        priceId: selectedPriceId,
      });

      if (response.paymentRequired) {
        window.open(response.checkoutUrl, '_blank');
        setOpen(false);

        return;
      }

      await refreshSession();
      setOpen(false);

      toast({
        title: t`Success`,
        description: t`Your organisation has been created.`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to create a organisation. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (actionSearchParam === 'add-organisation') {
      setOpen(true);
      updateSearchParams({ action: null });
    }
  }, [actionSearchParam, open]);

  useEffect(() => {
    form.reset();
  }, [open, form]);

  const isIndividualPlan = (priceId: string) => {
    return (
      plansData?.plans[INTERNAL_CLAIM_ID.INDIVIDUAL]?.monthlyPrice?.id === priceId ||
      plansData?.plans[INTERNAL_CLAIM_ID.INDIVIDUAL]?.yearlyPrice?.id === priceId
    );
  };

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Create organisation</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        {match(step)
          .with('billing', () => (
            <>
              <DialogHeader>
                <DialogTitle>
                  <Trans>Select a plan</Trans>
                </DialogTitle>

                <DialogDescription>
                  <Trans>Select a plan to continue</Trans>
                </DialogDescription>
              </DialogHeader>
              <fieldset aria-label="Plan select">
                {plansData ? (
                  <BillingPlanForm
                    value={selectedPriceId}
                    onChange={setSelectedPriceId}
                    plans={plansData.plans}
                    canCreateFreeOrganisation={plansData.canCreateFreeOrganisation}
                  />
                ) : (
                  <SpinnerBox className="py-32" />
                )}

                <DialogFooter className="mt-4">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  {isIndividualPlan(selectedPriceId) && isPersonalLayoutMode ? (
                    <IndividualPersonalLayoutCheckoutButton priceId={selectedPriceId}>
                      <Trans>Checkout</Trans>
                    </IndividualPersonalLayoutCheckoutButton>
                  ) : (
                    <Button type="submit" onClick={() => setStep('create')}>
                      <Trans>Continue</Trans>
                    </Button>
                  )}
                </DialogFooter>
              </fieldset>
            </>
          ))
          .with('create', () => (
            <>
              <DialogHeader>
                <DialogTitle>
                  <Trans>Create organisation</Trans>
                </DialogTitle>

                <DialogDescription>
                  <Trans>Create an organisation to collaborate with teams</Trans>
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onFormSubmit)}>
                  <fieldset
                    className="flex h-full flex-col space-y-4"
                    disabled={form.formState.isSubmitting}
                  >
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

                    <DialogFooter>
                      {IS_BILLING_ENABLED() ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setStep('billing')}
                        >
                          <Trans>Back</Trans>
                        </Button>
                      ) : (
                        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                          <Trans>Cancel</Trans>
                        </Button>
                      )}

                      <Button
                        type="submit"
                        data-testid="dialog-create-organisation-button"
                        loading={form.formState.isSubmitting}
                      >
                        {selectedPriceId ? <Trans>Checkout</Trans> : <Trans>Create</Trans>}
                      </Button>
                    </DialogFooter>
                  </fieldset>
                </form>
              </Form>
            </>
          ))

          .exhaustive()}
      </DialogContent>
    </Dialog>
  );
};

// This is separated from the internal claims constant because we need to use the msg
// macro which would cause import issues.
const internalClaimsDescription: {
  [key in INTERNAL_CLAIM_ID]: MessageDescriptor | string;
} = {
  [INTERNAL_CLAIM_ID.FREE]: msg`5 Documents a month`,
  [INTERNAL_CLAIM_ID.INDIVIDUAL]: msg`Unlimited documents, API and more`,
  [INTERNAL_CLAIM_ID.TEAM]: msg`Embedding, 5 members included and more`,
  [INTERNAL_CLAIM_ID.PLATFORM]: msg`Whitelabeling, unlimited members and more`,
  [INTERNAL_CLAIM_ID.ENTERPRISE]: '',
  [INTERNAL_CLAIM_ID.EARLY_ADOPTER]: '',
};

type BillingPlanFormProps = {
  value: string;
  onChange: (priceId: string) => void;
  plans: InternalClaimPlans;
  canCreateFreeOrganisation: boolean;
};

const BillingPlanForm = ({
  value,
  onChange,
  plans,
  canCreateFreeOrganisation,
}: BillingPlanFormProps) => {
  const { t } = useLingui();

  const [billingPeriod, setBillingPeriod] = useState<'monthlyPrice' | 'yearlyPrice'>('yearlyPrice');

  const dynamicPlans = useMemo(() => {
    return [INTERNAL_CLAIM_ID.INDIVIDUAL, INTERNAL_CLAIM_ID.TEAM, INTERNAL_CLAIM_ID.PLATFORM].map(
      (planId) => {
        const plan = plans[planId];

        return {
          id: planId,
          name: plan.name,
          description: parseMessageDescriptorMacro(t, internalClaimsDescription[planId]),
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
        };
      },
    );
  }, [plans]);

  useEffect(() => {
    if (value === '' && !canCreateFreeOrganisation) {
      onChange(dynamicPlans[0][billingPeriod]?.id ?? '');
    }
  }, [value]);

  const onBillingPeriodChange = (billingPeriod: 'monthlyPrice' | 'yearlyPrice') => {
    const plan = dynamicPlans.find(
      (plan) =>
        // Purposely using the opposite billing period to get the correct plan.
        plan[billingPeriod === 'monthlyPrice' ? 'yearlyPrice' : 'monthlyPrice']?.id === value,
    );

    setBillingPeriod(billingPeriod);

    onChange(plan?.[billingPeriod]?.id ?? Object.keys(plans)[0]);
  };

  return (
    <div className="space-y-4">
      <Tabs
        className="flex w-full items-center justify-center"
        defaultValue="monthlyPrice"
        value={billingPeriod}
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        onValueChange={(value) => onBillingPeriodChange(value as 'monthlyPrice' | 'yearlyPrice')}
      >
        <TabsList className="flex w-full justify-center">
          <TabsTrigger className="w-full" value="monthlyPrice">
            <Trans>Monthly</Trans>
          </TabsTrigger>
          <TabsTrigger className="w-full" value="yearlyPrice">
            <Trans>Yearly</Trans>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 grid gap-4 text-sm">
        <button
          onClick={() => onChange('')}
          className={cn(
            'hover:border-primary flex cursor-pointer items-center space-x-2 rounded-md border p-4 transition-all hover:shadow-sm',
            {
              'ring-primary/10 border-primary ring-2 ring-offset-1': '' === value,
            },
          )}
          disabled={!canCreateFreeOrganisation}
        >
          <div className="w-full text-left">
            <div className="flex items-center justify-between">
              <p className="text-medium">
                <Trans context="Plan price">Free</Trans>
              </p>

              <Badge size="small" variant="neutral" className="ml-1.5">
                {canCreateFreeOrganisation ? (
                  <Trans>1 Free organisations left</Trans>
                ) : (
                  <Trans>0 Free organisations left</Trans>
                )}
              </Badge>
            </div>

            <div className="text-muted-foreground">
              <Trans>5 documents a month</Trans>
            </div>
          </div>
        </button>

        {dynamicPlans.map((plan) => (
          <button
            key={plan[billingPeriod]?.id}
            onClick={() => onChange(plan[billingPeriod]?.id ?? '')}
            className={cn(
              'hover:border-primary flex cursor-pointer items-center space-x-2 rounded-md border p-4 transition-all hover:shadow-sm',
              {
                'ring-primary/10 border-primary ring-2 ring-offset-1':
                  plan[billingPeriod]?.id === value,
              },
            )}
          >
            <div className="w-full text-left">
              <p className="font-medium">{plan.name}</p>
              <p className="text-muted-foreground">{plan.description}</p>
            </div>
            <div className="whitespace-nowrap text-right text-sm font-medium">
              <p>{plan[billingPeriod]?.friendlyPrice}</p>
              <span className="text-muted-foreground text-xs">
                {billingPeriod === 'monthlyPrice' ? (
                  <Trans>per month</Trans>
                ) : (
                  <Trans>per year</Trans>
                )}
              </span>
            </div>
          </button>
        ))}

        <Link
          to="https://documen.so/enterprise-cta"
          target="_blank"
          className="bg-muted/30 flex items-center space-x-2 rounded-md border p-4"
        >
          <div className="flex-1 font-normal">
            <p className="text-muted-foreground font-medium">
              <Trans>Enterprise</Trans>
            </p>
            <p className="text-muted-foreground flex flex-row items-center gap-1">
              <Trans>Contact sales here</Trans>
              <ExternalLinkIcon className="h-4 w-4" />
            </p>
          </div>
        </Link>
      </div>

      <div className="mt-6 text-center">
        <Link
          to="https://documenso.com/pricing"
          className="text-primary hover:text-primary/80 flex items-center justify-center gap-1 text-sm hover:underline"
          target="_blank"
        >
          <Trans>Compare all plans and features in detail</Trans>
          <ExternalLinkIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};
