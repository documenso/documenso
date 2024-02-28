'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { FcGoogle } from 'react-icons/fc';
import { z } from 'zod';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { ZPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card } from '@documenso/ui/primitives/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

import ClaimUsernameCard from '../(dashboard)/claim-username-card/claim-username-card';

export const STEP = {
  SIGNUP: 'SIGNUP',
  CLAIM: 'CLAIM',
} as const;

type StepKeys = keyof typeof STEP;
type StepValues = (typeof STEP)[StepKeys];

const SIGN_UP_REDIRECT_PATH = '/documents';

export const ZSignUpFormSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
    email: z.string().email().min(1),
    password: ZPasswordSchema,
    signature: z.string().min(1, { message: 'We need your signature to sign documents' }),
    profileURL: z.string().trim().min(1, { message: 'Please enter a valid URL slug.' }),
  })
  .refine(
    (data) => {
      const { name, email, password } = data;
      return !password.includes(name) && !password.includes(email.split('@')[0]);
    },
    {
      message: 'Password should not be common or based on personal information',
    },
  );

export type TSignUpFormSchema = z.infer<typeof ZSignUpFormSchema>;

export type SignUpFormProps = {
  className?: string;
  initialEmail?: string;
  isGoogleSSOEnabled?: boolean;
};

export const SignUpForm = ({ className, initialEmail, isGoogleSSOEnabled }: SignUpFormProps) => {
  const { toast } = useToast();
  const analytics = useAnalytics();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<StepValues>(STEP.SIGNUP);

  let src: string | null = null;
  if (searchParams) {
    src = searchParams.get('src');
  }

  const form = useForm<TSignUpFormSchema>({
    values: {
      name: '',
      email: initialEmail ?? '',
      password: '',
      signature: '',
      profileURL: '',
    },
    resolver: zodResolver(ZSignUpFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  const signature = form.watch('signature');

  const { mutateAsync: signup } = trpc.auth.signup.useMutation();
  const { mutateAsync: updatePublicProfile } = trpc.profile.updatePublicProfile.useMutation();

  const onFormSubmit = async ({
    name,
    email,
    password,
    signature,
    profileURL,
  }: TSignUpFormSchema) => {
    try {
      await signup({ name, email, password, signature });

      await updatePublicProfile({
        profileURL,
      });

      await signIn('credentials', {
        email,
        password,
        callbackUrl: SIGN_UP_REDIRECT_PATH,
      });

      analytics.capture('App: User Sign Up', {
        email,
        timestamp: new Date().toISOString(),
        custom_campaign_params: { src },
      });
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'An error occurred',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'An unknown error occurred',
          description:
            'We encountered an unknown error while attempting to sign you up. Please try again later.',
          variant: 'destructive',
        });
      }
    }
  };

  const onNextStepClick = () => {
    if (step === STEP.SIGNUP) {
      setStep(STEP.CLAIM);

      setTimeout(() => {
        document.querySelector<HTMLElement>('#signature')?.focus();
      }, 0);
    }
  };

  const onSignUpWithGoogleClick = async () => {
    try {
      await signIn('google', { callbackUrl: SIGN_UP_REDIRECT_PATH });
    } catch (err) {
      toast({
        title: 'An unknown error occurred',
        description:
          'We encountered an unknown error while attempting to sign you Up. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const stepsRemaining = useMemo(() => {
    if (step === STEP.CLAIM) {
      return 2;
    }
    return 1;
  }, [step]);

  return (
    <>
      <ClaimUsernameCard className="col-span-12 gap-y-4 lg:col-span-7" />
      <Card className="col-span-12 gap-y-4 bg-gray-50 px-6 py-6 shadow-none lg:col-span-5">
        <div className="w-full">
          {step === STEP.SIGNUP && (
            <>
              <h1 className="text-3xl font-semibold">Create a new account</h1>

              <p className="text-muted-foreground/60 mt-2 text-sm">
                Create your account and start using state-of-the-art document signing. Open and
                beautiful signing is within your grasp.
              </p>
            </>
          )}
          {step === STEP.CLAIM && (
            <>
              <h1 className="text-3xl font-semibold">Claim your username now</h1>

              <p className="text-muted-foreground/60 mt-2 text-sm">
                You will get notified & be able to set up your documenso public profile when we
                launch the feature
              </p>
            </>
          )}
          <hr className="mb-6 mt-4" />
          <Form {...form}>
            <form
              className={cn('flex h-full w-full flex-col gap-y-4', className)}
              onSubmit={form.handleSubmit(onFormSubmit)}
            >
              <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
                <div className={cn(step === STEP.SIGNUP && 'hidden')}>
                  <FormField
                    control={form.control}
                    name="profileURL"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Public profile URL</FormLabel>
                        <FormControl>
                          <>
                            <Input id="username" type="text" className="mb-2 mt-2" {...field} />
                            <div className="mt-2">
                              <code className="bg-muted rounded-md px-1 py-1 text-sm">
                                documenso.com/u/
                              </code>
                            </div>
                          </>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className={cn('space-y-2', step === STEP.CLAIM && 'invisible')}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input type="text" className="bg-white" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" className="bg-white" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <PasswordInput className="bg-white" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="signature"
                    render={({ field: { onChange } }) => (
                      <FormItem>
                        <FormLabel>Sign Here</FormLabel>
                        <FormControl>
                          <SignaturePad
                            id="signatureText"
                            className="w-full"
                            disabled={isSubmitting}
                            containerClassName="mt-2 rounded-lg border bg-background"
                            onChange={(v) => onChange(v ?? '')}
                            height={200}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </fieldset>

              {isGoogleSSOEnabled && (
                <>
                  <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
                    <div className="bg-border h-px flex-1" />
                    <span className="text-muted-foreground bg-transparent">Or</span>
                    <div className="bg-border h-px flex-1" />
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    variant={'outline'}
                    className="bg-background text-muted-foreground border"
                    disabled={isSubmitting}
                    onClick={onSignUpWithGoogleClick}
                  >
                    <FcGoogle className="mr-2 h-5 w-5" />
                    Sign Up with Google
                  </Button>
                </>
              )}
              <p className="text-muted-foreground text-left text-sm">
                Already have an account?{' '}
                <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
                  Sign in instead
                </Link>
              </p>
              <div className="mt-6 flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  {isValid ? 'Claim username' : `Basic details ${stepsRemaining}/2`}
                </p>

                <p className="text-muted-foreground block text-xs md:hidden">Minimise contract</p>
              </div>

              <div className="bg-background relative h-[2px] w-full">
                <div
                  className={cn('bg-primary/60 absolute inset-y-0 left-0 duration-200', {
                    'w-1/2': stepsRemaining === 1,
                    'w-full': isValid,
                  })}
                />
              </div>
              {!isValid && (
                <Button
                  loading={isSubmitting}
                  className="dark:bg-documenso ml-auto w-52 dark:hover:opacity-90"
                  onClick={() => onNextStepClick()}
                >
                  Next
                </Button>
              )}
              {isValid && (
                <Button
                  type="submit"
                  loading={isSubmitting}
                  className="dark:bg-documenso ml-auto w-52 dark:hover:opacity-90"
                >
                  Complete
                </Button>
              )}
            </form>
          </Form>
        </div>
      </Card>
    </>
  );
};
