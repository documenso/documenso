import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { FaIdCardClip } from 'react-icons/fa6';
import { FcGoogle } from 'react-icons/fc';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import communityCardsImage from '@documenso/assets/images/community-cards.png';
import { authClient } from '@documenso/auth/client';
import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
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

import { UserProfileTimur } from '~/components/general/user-profile-timur';

export const ZSignUpFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: msg`Please enter a valid name.`.id }),
    email: z.string().email().min(1),
    password: ZPasswordSchema,
    signature: z.string().min(1, { message: msg`We need your signature to sign documents`.id }),
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
};

export type TSignUpFormSchema = z.infer<typeof ZSignUpFormSchema>;

export type SignUpFormProps = {
  className?: string;
  initialEmail?: string;
  isGoogleSSOEnabled?: boolean;
  isMicrosoftSSOEnabled?: boolean;
  isOIDCSSOEnabled?: boolean;
  returnTo?: string;
};

export const SignUpForm = ({
  className,
  initialEmail,
  isGoogleSSOEnabled,
  isMicrosoftSSOEnabled,
  isOIDCSSOEnabled,
  returnTo,
}: SignUpFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const analytics = useAnalytics();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const utmSrc = searchParams.get('utm_source') ?? null;

  const hasSocialAuthEnabled = isGoogleSSOEnabled || isMicrosoftSSOEnabled || isOIDCSSOEnabled;

  const form = useForm<TSignUpFormSchema>({
    values: {
      name: '',
      email: initialEmail ?? '',
      password: '',
      signature: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(ZSignUpFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async ({ name, email, password, signature }: TSignUpFormSchema) => {
    try {
      await authClient.emailPassword.signUp({
        name,
        email,
        password,
        signature,
      });

      await navigate(returnTo ? returnTo : '/unverified-account');

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

      toast({
        title: _(msg`An error occurred`),
        description: _(errorMessage),
        variant: 'destructive',
      });
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

  const onSignUpWithMicrosoftClick = async () => {
    try {
      await authClient.microsoft.signIn();
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
      <div className="relative hidden flex-1 overflow-hidden rounded-xl border border-border xl:flex">
        <div className="absolute -inset-8 -z-[2] backdrop-blur">
          <img
            src={communityCardsImage}
            alt="community-cards"
            className="h-full w-full object-cover dark:brightness-95 dark:contrast-[70%] dark:invert"
          />
        </div>

        <div className="absolute -inset-8 -z-[1] bg-background/50 backdrop-blur-[2px]" />

        <div className="relative flex h-full w-full flex-col items-center justify-evenly">
          <div className="rounded-2xl border bg-background px-4 py-1 text-sm font-medium">
            <Trans>User profiles are here!</Trans>
          </div>

          <div className="w-full max-w-md">
            <UserProfileTimur
              rows={2}
              className="rounded-2xl border border-border bg-background shadow-md"
            />
          </div>

          <div />
        </div>
      </div>

      <div className="relative z-10 flex min-h-[min(850px,80vh)] w-full max-w-lg flex-col rounded-xl border border-border bg-neutral-100 p-6 dark:bg-background">
        <div className="h-20">
          <h1 className="text-xl font-semibold md:text-2xl">
            <Trans>Create a new account</Trans>
          </h1>

          <p className="mt-2 text-xs text-muted-foreground md:text-sm">
            <Trans>
              Create your account and start using state-of-the-art document signing. Open and
              beautiful signing is within your grasp.
            </Trans>
          </p>
        </div>

        <hr className="-mx-6 my-4" />

        <Form {...form}>
          <form
            className="flex w-full flex-1 flex-col gap-y-4"
            onSubmit={form.handleSubmit(onFormSubmit)}
          >
            <fieldset
              className={cn(
                'flex min-h-[550px] w-full flex-col gap-y-4',
                hasSocialAuthEnabled && 'min-h-[650px]',
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

              {hasSocialAuthEnabled && (
                <>
                  <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
                    <div className="h-px flex-1 bg-border" />
                    <span className="bg-transparent text-muted-foreground">
                      <Trans>Or</Trans>
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              {isGoogleSSOEnabled && (
                <>
                  <Button
                    type="button"
                    size="lg"
                    variant={'outline'}
                    className="border bg-background text-muted-foreground"
                    disabled={isSubmitting}
                    onClick={onSignUpWithGoogleClick}
                  >
                    <FcGoogle className="mr-2 h-5 w-5" />
                    <Trans>Sign Up with Google</Trans>
                  </Button>
                </>
              )}

              {isMicrosoftSSOEnabled && (
                <>
                  <Button
                    type="button"
                    size="lg"
                    variant={'outline'}
                    className="border bg-background text-muted-foreground"
                    disabled={isSubmitting}
                    onClick={onSignUpWithMicrosoftClick}
                  >
                    <img
                      className="mr-2 h-4 w-4"
                      alt="Microsoft Logo"
                      src={'/static/microsoft.svg'}
                    />
                    <Trans>Sign Up with Microsoft</Trans>
                  </Button>
                </>
              )}

              {isOIDCSSOEnabled && (
                <>
                  <Button
                    type="button"
                    size="lg"
                    variant={'outline'}
                    className="border bg-background text-muted-foreground"
                    disabled={isSubmitting}
                    onClick={onSignUpWithOIDCClick}
                  >
                    <FaIdCardClip className="mr-2 h-5 w-5" />
                    <Trans>Sign Up with OIDC</Trans>
                  </Button>
                </>
              )}

              <p className="mt-4 text-sm text-muted-foreground">
                <Trans>
                  Already have an account?{' '}
                  <Link to="/signin" className="text-documenso-700 duration-200 hover:opacity-70">
                    Sign in instead
                  </Link>
                </Trans>
              </p>
            </fieldset>

            <Button
              loading={form.formState.isSubmitting}
              type="submit"
              size="lg"
              className="mt-6 w-full"
            >
              <Trans>Create account</Trans>
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-xs text-muted-foreground">
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
