'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { FcGoogle } from 'react-icons/fc';
import { z } from 'zod';

import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
import { ZCurrentPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ERROR_MESSAGES: Partial<Record<keyof typeof ErrorCode, string>> = {
  [ErrorCode.CREDENTIALS_NOT_FOUND]: 'The email or password provided is incorrect',
  [ErrorCode.INCORRECT_EMAIL_PASSWORD]: 'The email or password provided is incorrect',
  [ErrorCode.USER_MISSING_PASSWORD]:
    'This account appears to be using a social login method, please sign in using that method',
  [ErrorCode.INCORRECT_TWO_FACTOR_CODE]: 'The two-factor authentication code provided is incorrect',
  [ErrorCode.INCORRECT_TWO_FACTOR_BACKUP_CODE]: 'The backup code provided is incorrect',
  [ErrorCode.UNVERIFIED_EMAIL]:
    'This account has not been verified. Please verify your account before signing in.',
};

const TwoFactorEnabledErrorCode = ErrorCode.TWO_FACTOR_MISSING_CREDENTIALS;

const LOGIN_REDIRECT_PATH = '/documents';

export const ZSignInFormSchema = z.object({
  email: z.string().email().min(1),
  password: ZCurrentPasswordSchema,
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TSignInFormSchema = z.infer<typeof ZSignInFormSchema>;

export type SignInFormProps = {
  className?: string;
  initialEmail?: string;
  isGoogleSSOEnabled?: boolean;
};

export const SignInForm = ({ className, initialEmail, isGoogleSSOEnabled }: SignInFormProps) => {
  const { toast } = useToast();
  const [isTwoFactorAuthenticationDialogOpen, setIsTwoFactorAuthenticationDialogOpen] =
    useState(false);
  const router = useRouter();

  const [twoFactorAuthenticationMethod, setTwoFactorAuthenticationMethod] = useState<
    'totp' | 'backup'
  >('totp');

  const form = useForm<TSignInFormSchema>({
    values: {
      email: initialEmail ?? '',
      password: '',
      totpCode: '',
      backupCode: '',
    },
    resolver: zodResolver(ZSignInFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onCloseTwoFactorAuthenticationDialog = () => {
    form.setValue('totpCode', '');
    form.setValue('backupCode', '');

    setIsTwoFactorAuthenticationDialogOpen(false);
  };

  const onToggleTwoFactorAuthenticationMethodClick = () => {
    const method = twoFactorAuthenticationMethod === 'totp' ? 'backup' : 'totp';

    if (method === 'totp') {
      form.setValue('backupCode', '');
    }

    if (method === 'backup') {
      form.setValue('totpCode', '');
    }

    setTwoFactorAuthenticationMethod(method);
  };

  const onFormSubmit = async ({ email, password, totpCode, backupCode }: TSignInFormSchema) => {
    try {
      const credentials: Record<string, string> = {
        email,
        password,
      };

      if (totpCode) {
        credentials.totpCode = totpCode;
      }

      if (backupCode) {
        credentials.backupCode = backupCode;
      }

      const result = await signIn('credentials', {
        ...credentials,
        callbackUrl: LOGIN_REDIRECT_PATH,
        redirect: false,
      });

      if (result?.error && isErrorCode(result.error)) {
        if (result.error === TwoFactorEnabledErrorCode) {
          setIsTwoFactorAuthenticationDialogOpen(true);
          return;
        }

        const errorMessage = ERROR_MESSAGES[result.error];

        if (result.error === ErrorCode.UNVERIFIED_EMAIL) {
          router.push(`/unverified-account`);

          toast({
            title: 'Unable to sign in',
            description: errorMessage ?? 'An unknown error occurred',
          });

          return;
        }

        toast({
          variant: 'destructive',
          title: 'Unable to sign in',
          description: errorMessage ?? 'An unknown error occurred',
        });

        return;
      }

      if (!result?.url) {
        throw new Error('An unknown error occurred');
      }

      window.location.href = result.url;
    } catch (err) {
      toast({
        title: 'An unknown error occurred',
        description:
          'We encountered an unknown error while attempting to sign you In. Please try again later.',
      });
    }
  };

  const onSignInWithGoogleClick = async () => {
    try {
      await signIn('google', { callbackUrl: LOGIN_REDIRECT_PATH });
    } catch (err) {
      toast({
        title: 'An unknown error occurred',
        description:
          'We encountered an unknown error while attempting to sign you In. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form
        className={cn('flex w-full flex-col gap-y-4', className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>

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
                <FormLabel>Password</FormLabel>

                <FormControl>
                  <PasswordInput {...field} />
                </FormControl>

                <p className="mt-2 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-muted-foreground text-sm duration-200 hover:opacity-70"
                  >
                    Forgot your password?
                  </Link>
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          className="dark:bg-documenso dark:hover:opacity-90"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>

        {isGoogleSSOEnabled && (
          <>
            <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
              <div className="bg-border h-px flex-1" />
              <span className="text-muted-foreground bg-transparent">Or continue with</span>
              <div className="bg-border h-px flex-1" />
            </div>

            <Button
              type="button"
              size="lg"
              variant="outline"
              className="bg-background text-muted-foreground border"
              disabled={isSubmitting}
              onClick={onSignInWithGoogleClick}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              Google
            </Button>
          </>
        )}
      </form>

      <Dialog
        open={isTwoFactorAuthenticationDialogOpen}
        onOpenChange={onCloseTwoFactorAuthenticationDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset disabled={isSubmitting}>
              {twoFactorAuthenticationMethod === 'totp' && (
                <FormField
                  control={form.control}
                  name="totpCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authentication Token</FormLabel>
                      <FormControl>
                        <Input type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {twoFactorAuthenticationMethod === 'backup' && (
                <FormField
                  control={form.control}
                  name="backupCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel> Backup Code</FormLabel>
                      <FormControl>
                        <Input type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onToggleTwoFactorAuthenticationMethodClick}
                >
                  {twoFactorAuthenticationMethod === 'totp'
                    ? 'Use Backup Code'
                    : 'Use Authenticator'}
                </Button>

                <Button type="submit" loading={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </Form>
  );
};
