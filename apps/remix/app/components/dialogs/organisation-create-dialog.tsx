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
              </fieldset>

              <div className="mt-6 text-center">
                <Link
                  to="https://davincisolutions.ai"
                  className="flex items-center justify-center gap-1 text-sm text-primary hover:text-primary/80 hover:underline"
                  target="_blank"
                >
                  <Trans>Compare all plans and features in detail</Trans>
                  <ExternalLinkIcon className="h-4 w-4" />
                </Link>
              </div>

              <DialogFooter className="mt-4">
                <DialogClose asChild={true}>
                  <Button variant="secondary">
                    <Trans>Cancel</Trans>
                  </Button>
                </DialogClose>

                <Button
                  disabled={!selectedPriceId}
                  onClick={() => {
                    if (isPersonalLayoutMode && isIndividualPlan(selectedPriceId)) {
                      setStep('billing');
                      return;
                    }

                    setStep('create');
                  }}
                >
                  {isPersonalLayoutMode && isIndividualPlan(selectedPriceId) ? (
                    <Trans>Continue</Trans>
                  ) : (
                    <Trans>Select plan</Trans>
                  )}
                </Button>
              </DialogFooter>
            </>
          ))
          .with('create', () => (
            <>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onFormSubmit)}>
                  <DialogHeader>
                    <DialogTitle>
                      <Trans>Create organisation</Trans>
                    </DialogTitle>

                    <DialogDescription>
                      <Trans>
                        Organisations allow you to manage your team and documents in a single place.
                      </Trans>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <Trans>Organisation name</Trans>
                          </FormLabel>

                          <FormControl>
                            <Input {...field} />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter className="mt-4">
                    {IS_BILLING_ENABLED() && (
                      <Button type="button" variant="secondary" onClick={() => setStep('billing')}>
                        <Trans>Back</Trans>
                      </Button>
                    )}

                    <Button type="submit" loading={form.formState.isSubmitting}>
                      <Trans>Create organisation</Trans>
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          ))
          .exhaustive()}
      </DialogContent>
    </Dialog>
  );
};

type BillingPlanFormProps = {
  value: string;
  onChange: (value: string) => void;
  plans: InternalClaimPlans;
  canCreateFreeOrganisation: boolean;
};

const BillingPlanForm = ({
  value,
  onChange,
  plans,
  canCreateFreeOrganisation,
}: BillingPlanFormProps) => {
  const { organisations } = useSession();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const [billingPeriod, setBillingPeriod] = useState<'monthlyPrice' | 'yearlyPrice'>('yearlyPrice');

  const filteredPlans = useMemo(() => {
    const plansToReturn = Object.entries(plans).filter(([id]) => id !== INTERNAL_CLAIM_ID.FREE);

    if (canCreateFreeOrganisation) {
      plansToReturn.unshift([INTERNAL_CLAIM_ID.FREE, plans[INTERNAL_CLAIM_ID.FREE]]);
    }

    return plansToReturn;
  }, [plans, canCreateFreeOrganisation]);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex justify-center">
        <Tabs
          value={billingPeriod}
          onValueChange={(val) => setBillingPeriod(val as 'monthlyPrice' | 'yearlyPrice')}
        >
          <TabsList size="lg">
            <TabsTrigger value="monthlyPrice">
              <Trans>Monthly</Trans>
            </TabsTrigger>
            <TabsTrigger value="yearlyPrice">
              <span className="flex items-center gap-2">
                <Trans>Yearly</Trans>
                <Badge variant="success" className="bg-[#E7F6EC] text-[#036B26]">
                  <Trans>-20%</Trans>
                </Badge>
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex max-h-[400px] flex-col gap-4 overflow-y-auto px-1 py-1">
        {filteredPlans.map(([id, plan]) => {
          const isIndividual = id === INTERNAL_CLAIM_ID.INDIVIDUAL;

          return (
            <button
              key={id}
              onClick={() => onChange(plan[billingPeriod]?.id ?? '')}
              className={cn(
                'flex cursor-pointer items-center space-x-2 rounded-md border p-4 transition-all hover:border-primary hover:shadow-sm',
                {
                  'border-primary ring-2 ring-primary/10 ring-offset-1':
                    plan[billingPeriod]?.id === value,
                },
              )}
            >
              <div className="flex-grow text-left">
                <p className="font-semibold text-sm">
                  {parseMessageDescriptorMacro(plan.name as unknown as MessageDescriptor)}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {parseMessageDescriptorMacro(plan.description as unknown as MessageDescriptor)}
                </p>
              </div>
              <div className="whitespace-nowrap text-right font-medium text-sm">
                <p>{plan[billingPeriod]?.friendlyPrice}</p>
                <span className="text-xs text-muted-foreground">
                  {billingPeriod === 'monthlyPrice' ? (
                    <Trans>per month</Trans>
                  ) : (
                    <Trans>per year</Trans>
                  )}
                </span>
              </div>
              {isIndividual && isPersonalLayoutMode && (
                <IndividualPersonalLayoutCheckoutButton priceId={plan[billingPeriod]?.id ?? ''} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
