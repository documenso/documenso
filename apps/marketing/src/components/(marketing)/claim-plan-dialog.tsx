'use client';

import React, { useEffect, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { usePlausible } from 'next-plausible';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { claimPlan } from '~/api/claim-plan/fetcher';

import { FormErrorMessage } from '../form/form-error-message';

export const ZClaimPlanDialogFormSchema = z.object({
  name: z.string().trim().min(3, { message: 'Please enter a valid name.' }),
  email: z.string().email(),
});

export type TClaimPlanDialogFormSchema = z.infer<typeof ZClaimPlanDialogFormSchema>;

export type ClaimPlanDialogProps = {
  className?: string;
  planId: string;
  children: React.ReactNode;
};

export const ClaimPlanDialog = ({ className, planId, children }: ClaimPlanDialogProps) => {
  const params = useSearchParams();
  const analytics = useAnalytics();
  const event = usePlausible();

  const { toast } = useToast();

  const [open, setOpen] = useState(() => params?.get('cancelled') === 'true');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TClaimPlanDialogFormSchema>({
    defaultValues: {
      name: params?.get('name') ?? '',
      email: params?.get('email') ?? '',
    },
    resolver: zodResolver(ZClaimPlanDialogFormSchema),
  });

  const onFormSubmit = async ({ name, email }: TClaimPlanDialogFormSchema) => {
    try {
      const delay = new Promise<void>((resolve) => {
        setTimeout(resolve, 1000);
      });

      const [redirectUrl] = await Promise.all([
        claimPlan({ name, email, planId, signatureText: name, signatureDataUrl: null }),
        delay,
      ]);

      event('claim-plan-pricing');
      analytics.capture('Marketing: Claim plan', { planId, email });

      window.location.href = redirectUrl;
    } catch (error) {
      event('claim-plan-failed');
      analytics.capture('Marketing: Claim plan failure', { planId, email });

      toast({
        title: 'Something went wrong',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!isSubmitting && !open) {
      reset();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(value) => !isSubmitting && setOpen(value)}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim your plan</DialogTitle>

          <DialogDescription className="mt-4">
            We're almost there! Please enter your email address and name to claim your plan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)}>
          <fieldset disabled={isSubmitting} className={cn('flex flex-col gap-y-4', className)}>
            {params?.get('cancelled') === 'true' && (
              <div className="rounded-lg border border-yellow-400 bg-yellow-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Info className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm leading-5 text-yellow-700">
                      You have cancelled the payment process. If you didn't mean to do this, please
                      try again.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-muted-foreground">Name</Label>

              <Input type="text" className="mt-2" {...register('name')} autoFocus />

              <FormErrorMessage className="mt-1" error={errors.name} />
            </div>

            <div>
              <Label className="text-muted-foreground">Email</Label>

              <Input type="email" className="mt-2" {...register('email')} />

              <FormErrorMessage className="mt-1" error={errors.email} />
            </div>

            <Button type="submit" size="lg" loading={isSubmitting}>
              Claim the early adopters Plan (
              {/* eslint-disable-next-line turbo/no-undeclared-env-vars */}
              {planId === process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID
                ? 'Monthly'
                : 'Yearly'}
              )
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
};
