import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { FaIdCardClip } from 'react-icons/fa6';
import { FcGoogle } from 'react-icons/fc';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import communityCardsImage from '@documenso/assets/images/community-cards.png';
import { authClient } from '@documenso/auth/client';
import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { ZPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
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
import { SignaturePadDialog } from '@documenso/ui/primitives/signature-pad/signature-pad-dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { UserProfileSkeleton } from '~/components/general/user-profile-skeleton';
import { UserProfileTimur } from '~/components/general/user-profile-timur';

type SignUpStep = 'BASIC_DETAILS' | 'CLAIM_USERNAME';

export const ZSignUpFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: msg`Please enter a valid name.`.id }),
    email: z.string().email().min(1),
    password: ZPasswordSchema,
    signature: z.string().min(1, { message: msg`We need your signature to sign documents`.id }),
    url: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, { message: msg`We need a username to create your profile`.id })
      .regex(/^[a-z0-9-]+$/, {
        message: msg`Username can only container alphanumeric characters and dashes.`.id,
      }),
  })
  .refine(
    (data) => {
      const { name, email, password } = data;
      return !password.includes(name) && !password.includes(email.split('@')[0]);
    },
    {
      message: msg`Password should not be common or based on personal information`.id,
      path: ['password'],
    },
  );

export const signupErrorMessages: Record<string, MessageDescriptor> = {
  SIGNUP_DISABLED: msg`Signups are disabled.`,
  [AppErrorCode.ALREADY_EXISTS]: msg`User with this email already exists. Please use a different email address.`,
  [AppErrorCode.INVALID_REQUEST]: msg`We were unable to create your account. Please review the information you provided and try again.`,
  PROFILE_URL_TAKEN: msg`This username has already been taken`,
  PREMIUM_PROFILE_URL: msg`Only subscribers can have a username shorter than 6 characters`,
};

export type TSignUpFormSchema = z.infer<typeof ZSignUpFormSchema>;

export type SignUpFormProps = {
  className?: string;
  initialEmail?: string;
  isGoogleSSOEnabled?: boolean;
  isOIDCSSOEnabled?: boolean;
};

export const SignUpForm = ({
  className,
  initialEmail,
  isGoogleSSOEnabled,
  isOIDCSSOEnabled,
}: SignUpFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const analytics = useAnalytics();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<SignUpStep>('BASIC_DETAILS');

  const utmSrc = searchParams.get('utm_source') ?? null;

  const baseUrl = new URL(NEXT_PUBLIC_WEBAPP_URL() ?? 'http://localhost:3000');

  const form = useForm<TSignUpFormSchema>({
    values: {
      name: '',
      email: initialEmail ?? '',
      password: '',
      signature: '',
      url: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(ZSignUpFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const name = form.watch('name');
  const url = form.watch('url');

  const onFormSubmit = async ({ name, email, password, signature, url }: TSignUpFormSchema) => {
    try {
      await authClient.emailPassword.signUp({
        name,
        email,
        password,
        signature,
        url,
      });

      await navigate(`/unverified-account`);

      toast({
        title: _(msg`Registration Successful`),
        description: _(
          msg`You have successfully registered. Please verify your account by clicking on the link you received in the email.`,
        ),
        duration: 5000,
      });

      analytics.capture('App: User Sign Up', {
        email,
        timestamp: new Date().toISOString(),
        custom_campaign_params: { src: utmSrc },
      });
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = signupErrorMessages[error.code] ?? signupErrorMessages.INVALID_REQUEST;

      if (error.code === 'PROFILE_URL_TAKEN' || error.code === 'PREMIUM_PROFILE_URL') {
        form.setError('url', {
          type: 'manual',
          message: _(errorMessage),
        });
      } else {
        toast({
          title: _(msg`An error occurred`),
          description: _(errorMessage),
          variant: 'destructive',
        });
      }
    }
  };

  const onNextClick = async () => {
    const valid = await form.trigger(['name', 'email', 'password', 'signature']);

    if (valid) {
      setStep('CLAIM_USERNAME');
    }
  };

  const onSignUpWithGoogleClick = async () => {
    try {
      await authClient.google.signIn();
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to sign you Up. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  const onSignUpWithOIDCClick = async () => {
    try {
      await authClient.oidc.signIn();
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to sign you Up. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1);

    const params = new URLSearchParams(hash);

    const email = params.get('email');

    if (email) {
      form.setValue('email', email);
    }
  }, [form]);

  return (
    <div className={cn('flex justify-center gap-x-12', className)}>
      <div className="border-border relative hidden flex-1 overflow-hidden rounded-xl border xl:flex">
        <div className="absolute -inset-8 -z-[2] backdrop-blur">
          <img
            src={communityCardsImage}
            alt="community-cards"
            className="h-full w-full object-cover dark:brightness-95 dark:contrast-[70%] dark:invert"
          />
        </div>

        <div className="bg-background/50 absolute -inset-8 -z-[1] backdrop-blur-[2px]" />

        <div className="relative flex h-full w-full flex-col items-center justify-evenly">
          <div className="bg-background rounded-2xl border px-4 py-1 text-sm font-medium">
            <Trans>User profiles are here!</Trans>
          </div>

          <AnimatePresence>
            {step === 'BASIC_DETAILS' ? (
              <motion.div className="w-full max-w-md" layoutId="user-profile">
                <UserProfileTimur
                  rows={2}
                  className="bg-background border-border rounded-2xl border shadow-md"
                />
              </motion.div>
            ) : (
              <motion.div className="w-full max-w-md" layoutId="user-profile">
                <UserProfileSkeleton
                  user={{ name, url }}
                  rows={2}
                  className="bg-background border-border rounded-2xl border shadow-md"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div />
        </div>
      </div>

      <div className="border-border dark:bg-background relative z-10 flex min-h-[min(850px,80vh)] w-full max-w-lg flex-col rounded-xl border bg-neutral-100 p-6">
        {step === 'BASIC_DETAILS' && (
          <div className="h-20">
            <h1 className="text-xl font-semibold md:text-2xl">
              <Trans>Create a new account</Trans>
            </h1>

            <p className="text-muted-foreground mt-2 text-xs md:text-sm">
              <Trans>
                Create your account and start using state-of-the-art document signing. Open and
                beautiful signing is within your grasp.
              </Trans>
            </p>
          </div>
        )}

        {step === 'CLAIM_USERNAME' && (
          <div className="h-20">
            <h1 className="text-xl font-semibold md:text-2xl">
              <Trans>Claim your username now</Trans>
            </h1>

            <p className="text-muted-foreground mt-2 text-xs md:text-sm">
              <Trans>
                You will get notified & be able to set up your documenso public profile when we
                launch the feature.
              </Trans>
            </p>
          </div>
        )}

        <hr className="-mx-6 my-4" />

        <Form {...form}>
          <form
            className="flex w-full flex-1 flex-col gap-y-4"
            onSubmit={form.handleSubmit(onFormSubmit)}
          >
            {step === 'BASIC_DETAILS' && (
              <fieldset
                className={cn(
                  'flex h-[550px] w-full flex-col gap-y-4',
                  (isGoogleSSOEnabled || isOIDCSSOEnabled) && 'h-[650px]',
                )}
                disabled={isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Full Name</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input type="text" {...field} />
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
                      <FormLabel>
                        <Trans>Email Address</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
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
                      <FormLabel>
                        <Trans>Password</Trans>
                      </FormLabel>

                      <FormControl>
                        <PasswordInput {...field} />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signature"
                  render={({ field: { onChange, value } }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Sign Here</Trans>
                      </FormLabel>
                      <FormControl>
                        <SignaturePadDialog
                          disabled={isSubmitting}
                          value={value}
                          onChange={(v) => onChange(v ?? '')}
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(isGoogleSSOEnabled || isOIDCSSOEnabled) && (
                  <>
                    <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
                      <div className="bg-border h-px flex-1" />
                      <span className="text-muted-foreground bg-transparent">
                        <Trans>Or</Trans>
                      </span>
                      <div className="bg-border h-px flex-1" />
                    </div>
                  </>
                )}

                {isGoogleSSOEnabled && (
                  <>
                    <Button
                      type="button"
                      size="lg"
                      variant={'outline'}
                      className="bg-background text-muted-foreground border"
                      disabled={isSubmitting}
                      onClick={onSignUpWithGoogleClick}
                    >
                      <FcGoogle className="mr-2 h-5 w-5" />
                      <Trans>Sign Up with Google</Trans>
                    </Button>
                  </>
                )}

                {isOIDCSSOEnabled && (
                  <>
                    <Button
                      type="button"
                      size="lg"
                      variant={'outline'}
                      className="bg-background text-muted-foreground border"
                      disabled={isSubmitting}
                      onClick={onSignUpWithOIDCClick}
                    >
                      <FaIdCardClip className="mr-2 h-5 w-5" />
                      <Trans>Sign Up with OIDC</Trans>
                    </Button>
                  </>
                )}

                <p className="text-muted-foreground mt-4 text-sm">
                  <Trans>
                    Already have an account?{' '}
                    <Link to="/signin" className="text-documenso-700 duration-200 hover:opacity-70">
                      Sign in instead
                    </Link>
                  </Trans>
                </p>
              </fieldset>
            )}

            {step === 'CLAIM_USERNAME' && (
              <fieldset
                className={cn(
                  'flex h-[550px] w-full flex-col gap-y-4',
                  isGoogleSSOEnabled && 'h-[650px]',
                )}
                disabled={isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Public profile username</Trans>
                      </FormLabel>

                      <FormControl>
                        <Input type="text" className="mb-2 mt-2 lowercase" {...field} />
                      </FormControl>

                      <FormMessage />

                      <div className="bg-muted/50 border-border text-muted-foreground mt-2 inline-block max-w-[16rem] truncate rounded-md border px-2 py-1 text-sm lowercase">
                        {baseUrl.host}/u/{field.value || '<username>'}
                      </div>
                    </FormItem>
                  )}
                />
              </fieldset>
            )}

            <div className="mt-6">
              {step === 'BASIC_DETAILS' && (
                <p className="text-muted-foreground text-sm">
                  <span className="font-medium">
                    <Trans>Basic details</Trans>
                  </span>{' '}
                  1/2
                </p>
              )}

              {step === 'CLAIM_USERNAME' && (
                <p className="text-muted-foreground text-sm">
                  <span className="font-medium">
                    <Trans>Claim username</Trans>
                  </span>{' '}
                  2/2
                </p>
              )}

              <div className="bg-foreground/40 relative mt-4 h-1.5 rounded-full">
                <motion.div
                  layout="size"
                  layoutId="document-flow-container-step"
                  className="bg-documenso absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: step === 'BASIC_DETAILS' ? '50%' : '100%',
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-x-4">
              {/* Go back button, disabled if step is basic details */}
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="flex-1"
                disabled={step === 'BASIC_DETAILS' || form.formState.isSubmitting}
                onClick={() => setStep('BASIC_DETAILS')}
              >
                <Trans>Back</Trans>
              </Button>

              {/* Continue button */}
              {step === 'BASIC_DETAILS' && (
                <Button
                  type="button"
                  size="lg"
                  className="flex-1 disabled:cursor-not-allowed"
                  loading={form.formState.isSubmitting}
                  onClick={onNextClick}
                >
                  <Trans>Next</Trans>
                </Button>
              )}

              {/* Sign up button */}
              {step === 'CLAIM_USERNAME' && (
                <Button
                  loading={form.formState.isSubmitting}
                  disabled={!form.formState.isValid}
                  type="submit"
                  size="lg"
                  className="flex-1"
                >
                  <Trans>Complete</Trans>
                </Button>
              )}
            </div>
          </form>
        </Form>
        <p className="text-muted-foreground mt-6 text-xs">
          <Trans>
            By proceeding, you agree to our{' '}
            <Link
              to="https://documen.so/terms"
              target="_blank"
              className="text-documenso-700 duration-200 hover:opacity-70"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              to="https://documen.so/privacy"
              target="_blank"
              className="text-documenso-700 duration-200 hover:opacity-70"
            >
              Privacy Policy
            </Link>
            .
          </Trans>
        </p>
      </div>
    </div>
  );
};
