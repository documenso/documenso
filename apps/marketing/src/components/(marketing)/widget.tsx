'use client';

<<<<<<< HEAD
import { HTMLAttributes, KeyboardEvent, useMemo, useState } from 'react';
=======
import type { HTMLAttributes, KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';
>>>>>>> main

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader } from 'lucide-react';
import { usePlausible } from 'next-plausible';
<<<<<<< HEAD
=======
import { env } from 'next-runtime-env';
>>>>>>> main
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { claimPlan } from '~/api/claim-plan/fetcher';

<<<<<<< HEAD
=======
import { STEP } from '../constants';
>>>>>>> main
import { FormErrorMessage } from '../form/form-error-message';

const ZWidgetFormSchema = z
  .object({
    email: z.string().email({ message: 'Please enter a valid email address.' }),
    name: z.string().trim().min(3, { message: 'Please enter a valid name.' }),
  })
  .and(
    z.union([
      z.object({
        signatureDataUrl: z.string().min(1),
        signatureText: z.null().or(z.string().max(0)),
      }),
      z.object({
        signatureDataUrl: z.null().or(z.string().max(0)),
        signatureText: z.string().trim().min(1),
      }),
    ]),
  );

export type TWidgetFormSchema = z.infer<typeof ZWidgetFormSchema>;

<<<<<<< HEAD
=======
type StepKeys = keyof typeof STEP;
type StepValues = (typeof STEP)[StepKeys];

>>>>>>> main
export type WidgetProps = HTMLAttributes<HTMLDivElement>;

export const Widget = ({ className, children, ...props }: WidgetProps) => {
  const { toast } = useToast();
  const event = usePlausible();

<<<<<<< HEAD
  const [step, setStep] = useState<'EMAIL' | 'NAME' | 'SIGN'>('EMAIL');
=======
  const [step, setStep] = useState<StepValues>(STEP.EMAIL);
>>>>>>> main
  const [showSigningDialog, setShowSigningDialog] = useState(false);
  const [draftSignatureDataUrl, setDraftSignatureDataUrl] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<TWidgetFormSchema>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      name: '',
      signatureDataUrl: null,
      signatureText: '',
    },
    resolver: zodResolver(ZWidgetFormSchema),
  });

  const signatureDataUrl = watch('signatureDataUrl');
  const signatureText = watch('signatureText');

  const stepsRemaining = useMemo(() => {
<<<<<<< HEAD
    if (step === 'NAME') {
      return 2;
    }

    if (step === 'SIGN') {
      return 1;
    }

    return 3;
  }, [step]);

  const onNextStepClick = () => {
    if (step === 'EMAIL') {
      setStep('NAME');
=======
    if (step === STEP.NAME) {
      return 2;
    }

    if (step === STEP.EMAIL) {
      return 3;
    }

    return 1;
  }, [step]);

  const onNextStepClick = () => {
    if (step === STEP.EMAIL) {
      setStep(STEP.NAME);
>>>>>>> main

      setTimeout(() => {
        document.querySelector<HTMLElement>('#name')?.focus();
      }, 0);
    }

<<<<<<< HEAD
    if (step === 'NAME') {
      setStep('SIGN');
=======
    if (step === STEP.NAME) {
      setStep(STEP.SIGN);
>>>>>>> main

      setTimeout(() => {
        document.querySelector<HTMLElement>('#signatureText')?.focus();
      }, 0);
    }
  };

  const onEnterPress = (callback: () => void) => {
    return (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();

        callback();
      }
    };
  };

  const onSignatureConfirmClick = () => {
    setValue('signatureDataUrl', draftSignatureDataUrl);
    setValue('signatureText', '');

    void trigger('signatureDataUrl');
    setShowSigningDialog(false);
  };

  const onFormSubmit = async ({
    email,
    name,
    signatureDataUrl,
    signatureText,
  }: TWidgetFormSchema) => {
    try {
      const delay = new Promise<void>((resolve) => {
        setTimeout(resolve, 1000);
      });

<<<<<<< HEAD
      const planId = process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID;
=======
      const planId = env('NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID');

      if (!planId) {
        throw new Error('No plan ID found.');
      }
>>>>>>> main

      const claimPlanInput = signatureDataUrl
        ? {
            name,
            email,
            planId,
            signatureDataUrl: signatureDataUrl,
            signatureText: null,
          }
        : {
            name,
            email,
            planId,
            signatureDataUrl: null,
            signatureText: signatureText ?? '',
          };

      const [result] = await Promise.all([claimPlan(claimPlanInput), delay]);

      event('claim-plan-widget');

      window.location.href = result;
    } catch (error) {
      event('claim-plan-failed');

      toast({
        title: 'Something went wrong',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Card
        className={cn('mx-auto w-full max-w-4xl rounded-3xl before:rounded-3xl', className)}
        gradient
        {...props}
      >
        <div className="grid grid-cols-12 gap-y-8 overflow-hidden p-2 lg:gap-x-8">
          <div className="text-muted-foreground col-span-12 flex flex-col gap-y-4 p-4 text-xs leading-relaxed lg:col-span-7">
            {children}
          </div>

          <form
            className="bg-foreground/5 col-span-12 flex flex-col rounded-2xl p-6 lg:col-span-5"
            onSubmit={handleSubmit(onFormSubmit)}
          >
<<<<<<< HEAD
            <h3 className="text-2xl font-semibold">Sign up for the early adopters plan</h3>
=======
            <h3 className="text-xl font-semibold">Sign up to Early Adopter Plan</h3>
>>>>>>> main
            <p className="text-muted-foreground mt-2 text-xs">
              with Timur Ercan & Lucas Smith from Documenso
            </p>

            <hr className="mb-6 mt-4" />

            <AnimatePresence>
              <motion.div key="email">
<<<<<<< HEAD
                <label htmlFor="email" className="text-foreground text-lg font-semibold lg:text-xl">
=======
                <label htmlFor="email" className="text-foreground font-medium ">
>>>>>>> main
                  What’s your email?
                </label>

                <Controller
                  control={control}
                  name="email"
                  render={({ field }) => (
                    <div className="relative mt-2">
                      <Input
                        id="email"
                        type="email"
<<<<<<< HEAD
                        placeholder=""
=======
                        placeholder="your@example.com"
>>>>>>> main
                        className="bg-background w-full pr-16"
                        disabled={isSubmitting}
                        onKeyDown={(e) =>
                          field.value !== '' &&
                          !errors.email?.message &&
                          onEnterPress(onNextStepClick)(e)
                        }
                        {...field}
                      />

                      <div className="absolute inset-y-0 right-0 p-1.5">
                        <Button
                          type="button"
                          className="bg-primary h-full w-14 rounded"
                          disabled={!field.value || !!errors.email?.message}
<<<<<<< HEAD
                          onClick={() => onNextStepClick()}
=======
                          onClick={() => step === STEP.EMAIL && onNextStepClick()}
>>>>>>> main
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                />

                <FormErrorMessage error={errors.email} className="mt-1" />
              </motion.div>

<<<<<<< HEAD
              {(step === 'NAME' || step === 'SIGN') && (
=======
              {(step === STEP.NAME || step === STEP.SIGN) && (
>>>>>>> main
                <motion.div
                  key="name"
                  className="mt-4"
                  animate={{
                    opacity: 1,
                    transform: 'translateX(0)',
                  }}
                  initial={{
                    opacity: 0,
                    transform: 'translateX(-25%)',
                  }}
                  exit={{
                    opacity: 0,
                    transform: 'translateX(25%)',
                  }}
                >
<<<<<<< HEAD
                  <label
                    htmlFor="name"
                    className="text-foreground text-lg font-semibold lg:text-xl"
                  >
                    and your name?
=======
                  <label htmlFor="name" className="text-foreground font-medium ">
                    And your name?
>>>>>>> main
                  </label>

                  <Controller
                    control={control}
                    name="name"
                    render={({ field }) => (
                      <div className="relative mt-2">
                        <Input
                          id="name"
                          type="text"
                          placeholder=""
                          className="bg-background w-full pr-16"
                          disabled={isSubmitting}
                          onKeyDown={(e) =>
                            field.value !== '' &&
                            !errors.name?.message &&
                            onEnterPress(onNextStepClick)(e)
                          }
                          {...field}
                        />

                        <div className="absolute inset-y-0 right-0 p-1.5">
                          <Button
                            type="button"
                            className="bg-primary h-full w-14 rounded"
                            disabled={!field.value || !!errors.name?.message}
                            onClick={() => onNextStepClick()}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  />

                  <FormErrorMessage error={errors.name} className="mt-1" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-12 flex-1" />

            <div className="flex items-center justify-between">
<<<<<<< HEAD
              <p className="text-muted-foreground text-xs">{stepsRemaining} step(s) until signed</p>
=======
              <p className="text-muted-foreground text-xs">
                {isValid ? 'Ready for Signing' : `${stepsRemaining} step(s) until signed`}
              </p>

>>>>>>> main
              <p className="text-muted-foreground block text-xs md:hidden">Minimise contract</p>
            </div>

            <div className="bg-background relative mt-2.5 h-[2px] w-full">
              <div
                className={cn('bg-primary/60 absolute inset-y-0 left-0 duration-200', {
                  'w-1/3': stepsRemaining === 3,
                  'w-2/3': stepsRemaining === 2,
                  'w-11/12': stepsRemaining === 1,
<<<<<<< HEAD
=======
                  'w-full': isValid,
>>>>>>> main
                })}
              />
            </div>

            <Card id="signature" className="mt-4" degrees={-140} gradient>
              <CardContent
                role="button"
                className="relative cursor-pointer pt-6"
                onClick={() => setShowSigningDialog(true)}
              >
                <div className="flex h-28 items-center justify-center pb-6">
                  {!signatureText && signatureDataUrl && (
                    <img
                      src={signatureDataUrl}
                      alt="user signature"
                      className="h-full dark:invert"
                    />
                  )}

                  {signatureText && (
                    <p
                      className={cn(
<<<<<<< HEAD
                        'text-foreground text-4xl font-semibold [font-family:var(--font-caveat)]',
=======
                        'text-foreground truncate text-4xl font-semibold [font-family:var(--font-caveat)]',
>>>>>>> main
                      )}
                    >
                      {signatureText}
                    </p>
                  )}
                </div>

                <div
                  className="absolute inset-x-0 bottom-0 flex cursor-auto items-center justify-between px-4 pb-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    id="signatureText"
<<<<<<< HEAD
                    className="text-foreground placeholder:text-muted-foreground border-none p-0 text-sm focus-visible:ring-0"
=======
                    className="text-foreground placeholder:text-muted-foreground truncate border-none p-0 text-sm focus-visible:ring-0"
>>>>>>> main
                    placeholder="Draw or type name here"
                    disabled={isSubmitting}
                    {...register('signatureText', {
                      onChange: (e) => {
                        if (e.target.value !== '') {
                          setValue('signatureDataUrl', null);
                        }
                      },
                    })}
                  />

                  <Button
                    type="submit"
                    className="disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted h-8"
                    disabled={!isValid || isSubmitting}
                  >
                    {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                    Sign
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </Card>

      <Dialog open={showSigningDialog} onOpenChange={setShowSigningDialog}>
        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>Add your signature</DialogTitle>
          </DialogHeader>

          <DialogDescription>
            By signing you signal your support of Documenso's mission in a <br></br>
            <strong>non-legally binding, but heartfelt way</strong>. <br></br>
            <br></br>You also unlock the option to purchase the early supporter plan including
            everything we build this year for fixed price.
          </DialogDescription>

          <SignaturePad
<<<<<<< HEAD
=======
            disabled={isSubmitting}
>>>>>>> main
            className="aspect-video w-full rounded-md border"
            defaultValue={signatureDataUrl || ''}
            onChange={setDraftSignatureDataUrl}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSigningDialog(false)}>
              Cancel
            </Button>

            <Button onClick={() => onSignatureConfirmClick()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
