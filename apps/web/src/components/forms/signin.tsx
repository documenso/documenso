'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { FcGoogle } from 'react-icons/fc';
import { z } from 'zod';

import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@documenso/ui/primitives/dialog';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input, PasswordInput } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ERROR_MESSAGES: Partial<Record<keyof typeof ErrorCode, string>> = {
  [ErrorCode.CREDENTIALS_NOT_FOUND]: 'The email or password provided is incorrect',
  [ErrorCode.INCORRECT_EMAIL_PASSWORD]: 'The email or password provided is incorrect',
  [ErrorCode.USER_MISSING_PASSWORD]:
    'This account appears to be using a social login method, please sign in using that method',
  [ErrorCode.INCORRECT_TWO_FACTOR_CODE]: 'The two-factor authentication code provided is incorrect',
  [ErrorCode.INCORRECT_TWO_FACTOR_BACKUP_CODE]: 'The backup code provided is incorrect',
};

const TwoFactorEnabledErrorCode = ErrorCode.TWO_FACTOR_MISSING_CREDENTIALS;

const LOGIN_REDIRECT_PATH = '/documents';

export const ZSignInFormSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(6).max(72),
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TSignInFormSchema = z.infer<typeof ZSignInFormSchema>;

export type SignInFormProps = {
  className?: string;
};

export const SignInForm = ({ className }: SignInFormProps) => {
  const { toast } = useToast();
  const [isTwoFactorAuthenticationDialogOpen, setIsTwoFactorAuthenticationDialogOpen] =
    useState(false);

  const [twoFactorAuthenticationMethod, setTwoFactorAuthenticationMethod] = useState<
    'totp' | 'backup'
  >('totp');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TSignInFormSchema>({
    values: {
      email: '',
      password: '',
      totpCode: '',
      backupCode: '',
    },
    resolver: zodResolver(ZSignInFormSchema),
  });

  const onCloseTwoFactorAuthenticationDialog = () => {
    setValue('totpCode', '');
    setValue('backupCode', '');

    setIsTwoFactorAuthenticationDialogOpen(false);
  };

  const onToggleTwoFactorAuthenticationMethodClick = () => {
    const method = twoFactorAuthenticationMethod === 'totp' ? 'backup' : 'totp';

    if (method === 'totp') {
      setValue('backupCode', '');
    }

    if (method === 'backup') {
      setValue('totpCode', '');
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
    <form
      className={cn('flex w-full flex-col gap-y-4', className)}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div>
        <Label htmlFor="email" className="text-muted-forground">
          Email
        </Label>

        <Input id="email" type="email" className="bg-background mt-2" {...register('email')} />

        <FormErrorMessage className="mt-1.5" error={errors.email} />
      </div>

      <div>
        <Label htmlFor="password" className="text-muted-forground">
          <span>Password</span>
        </Label>

        <PasswordInput
          id="password"
          minLength={6}
          maxLength={72}
          className="bg-background mt-2"
          autoComplete="current-password"
          {...register('password')}
        />

        <FormErrorMessage className="mt-1.5" error={errors.password} />
      </div>

      <Button
        size="lg"
        loading={isSubmitting}
        disabled={isSubmitting}
        className="dark:bg-documenso dark:hover:opacity-90"
      >
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </Button>

      <div className="relative flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
        <div className="bg-border h-px flex-1" />
        <span className="text-muted-foreground bg-transparent">Or continue with</span>
        <div className="bg-border h-px flex-1" />
      </div>

      <Button
        type="button"
        size="lg"
        variant={'outline'}
        className="bg-background text-muted-foreground border"
        disabled={isSubmitting}
        onClick={onSignInWithGoogleClick}
      >
        <FcGoogle className="mr-2 h-5 w-5" />
        Google
      </Button>

      <Dialog
        open={isTwoFactorAuthenticationDialogOpen}
        onOpenChange={onCloseTwoFactorAuthenticationDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onFormSubmit)}>
            {twoFactorAuthenticationMethod === 'totp' && (
              <div>
                <Label htmlFor="totpCode" className="text-muted-forground">
                  Authentication Token
                </Label>

                <Input
                  id="totpCode"
                  type="text"
                  className="bg-background mt-2"
                  {...register('totpCode')}
                />

                <FormErrorMessage className="mt-1.5" error={errors.totpCode} />
              </div>
            )}

            {twoFactorAuthenticationMethod === 'backup' && (
              <div>
                <Label htmlFor="backupCode" className="text-muted-forground">
                  Backup Code
                </Label>

                <Input
                  id="backupCode"
                  type="text"
                  className="bg-background mt-2"
                  {...register('backupCode')}
                />

                <FormErrorMessage className="mt-1.5" error={errors.backupCode} />
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={onToggleTwoFactorAuthenticationMethodClick}
              >
                {twoFactorAuthenticationMethod === 'totp' ? 'Use Backup Code' : 'Use Authenticator'}
              </Button>

              <Button type="submit" loading={isSubmitting}>
                Sign In
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </form>
  );
};
